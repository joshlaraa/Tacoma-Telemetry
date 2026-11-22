#include "tacoma/sim/TacomaSimulator.h"

#include <gtest/gtest.h>

#include <chrono>
#include <condition_variable>
#include <mutex>
#include <vector>

namespace {

// The callback runs on the simulator worker, so the test harness must protect
// both the captured frames and the condition-variable predicate.
struct FrameCapture {
    std::mutex mutex;  // Protects frames while the simulator callback thread writes them.
    std::condition_variable condition;
    std::vector<tacoma::core::TelemetryFrame> frames;
};

// Waiting on a predicate avoids flaky fixed sleeps and handles spurious
// wake-ups correctly.
void wait_for_frames(FrameCapture& capture, std::size_t count) {
    std::unique_lock lock(capture.mutex);
    ASSERT_TRUE(capture.condition.wait_for(
        lock, std::chrono::seconds{4},
        [&capture, count] { return capture.frames.size() >= count; }));
}

}  // namespace

// Verify the real-time producer publishes near its documented 10 Hz cadence.
TEST(TacomaSimulatorTest, ProducesFramesAtTenHertz) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        {
            std::lock_guard lock(capture.mutex);
            capture.frames.push_back(frame);
        }
        capture.condition.notify_one();
    });

    simulator.start();
    wait_for_frames(capture, 7);
    simulator.stop();

    std::vector<tacoma::core::TelemetryFrame> frames;
    {
        std::lock_guard lock(capture.mutex);
        frames = capture.frames;
    }

    ASSERT_GE(frames.size(), 7U);
    for (std::size_t index = 1; index < frames.size(); ++index) {
        const double interval_seconds = std::chrono::duration<double>(
            frames[index].timestamp - frames[index - 1].timestamp).count();
        EXPECT_GT(interval_seconds, 0.05);
        EXPECT_LT(interval_seconds, 0.25);
    }
}

// Verify all externally visible values remain inside the simulator's safety
// bounds while the worker is running.
TEST(TacomaSimulatorTest, KeepsValuesInRealisticRanges) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        {
            std::lock_guard lock(capture.mutex);
            capture.frames.push_back(frame);
        }
        capture.condition.notify_one();
    });

    simulator.start();
    wait_for_frames(capture, 20);
    simulator.stop();

    std::lock_guard lock(capture.mutex);
    ASSERT_GE(capture.frames.size(), 20U);
    for (const auto& frame : capture.frames) {
        EXPECT_GE(frame.rpm, 650.0);
        EXPECT_LE(frame.rpm, 5800.0);
        EXPECT_GE(frame.speed_kmh, 0.0);
        EXPECT_LE(frame.speed_kmh, 160.0);
        EXPECT_GE(frame.coolant_temp_c, 0.0);
        EXPECT_LE(frame.coolant_temp_c, 110.0);
        EXPECT_GE(frame.throttle_pct, 0.0);
        EXPECT_LE(frame.throttle_pct, 100.0);
        EXPECT_GE(frame.engine_load_pct, 0.0);
        EXPECT_LE(frame.engine_load_pct, 100.0);
    }
}

// The model should warm slowly enough that a cold start remains visibly cold
// during the first 30 simulated seconds.
TEST(TacomaSimulatorTest, CoolantIsStillColdAfterThirtySimulatedSeconds) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        std::lock_guard lock(capture.mutex);
        capture.frames.push_back(frame);
    });

    simulator.advance_simulated_time(30.0);

    std::lock_guard lock(capture.mutex);
    ASSERT_FALSE(capture.frames.empty());
    EXPECT_LT(capture.frames.back().coolant_temp_c, 40.0);
}

// The warm-up curve should be plausibly midway to operating temperature, not
// merely satisfy the cold-start and long-run endpoint checks.
TEST(TacomaSimulatorTest, CoolantIsMidCurveAfterThreeSimulatedMinutes) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        std::lock_guard lock(capture.mutex);
        capture.frames.push_back(frame);
    });

    simulator.advance_simulated_time(180.0);

    std::lock_guard lock(capture.mutex);
    ASSERT_FALSE(capture.frames.empty());
    EXPECT_GE(capture.frames.back().coolant_temp_c, 55.0);
    EXPECT_LE(capture.frames.back().coolant_temp_c, 75.0);
}

// A long manual run should reach normal operating temperature without waiting
// fifteen real-time minutes.
TEST(TacomaSimulatorTest, ReachesOperatingTemperatureWithinFifteenMinutes) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        std::lock_guard lock(capture.mutex);
        capture.frames.push_back(frame);
    });

    simulator.advance_simulated_time(900.0);

    std::lock_guard lock(capture.mutex);
    ASSERT_FALSE(capture.frames.empty());
    EXPECT_GE(capture.frames.back().coolant_temp_c, 85.0);
}

// Once warm, coolant should remain inside the thermostat's requested operating
// band rather than continuing to rise indefinitely.
TEST(TacomaSimulatorTest, ThermostatHoldsCoolantAfterWarmup) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        std::lock_guard lock(capture.mutex);
        capture.frames.push_back(frame);
    });

    simulator.advance_simulated_time(900.0);
    std::size_t warm_frame_count;
    {
        std::lock_guard lock(capture.mutex);
        warm_frame_count = capture.frames.size();
    }
    simulator.advance_simulated_time(120.0);

    std::lock_guard lock(capture.mutex);
    ASSERT_GT(capture.frames.size(), warm_frame_count);
    for (std::size_t index = warm_frame_count; index < capture.frames.size();
         ++index) {
        EXPECT_GE(capture.frames[index].coolant_temp_c, 88.0);
        EXPECT_LE(capture.frames[index].coolant_temp_c, 92.0);
    }
}

// This checks the observable signature of an upshift: RPM drops while road
// speed continues to increase.
TEST(TacomaSimulatorTest, GearShiftDropsRpmWhileSpeedContinuesToRise) {
    FrameCapture capture;
    tacoma::sim::TacomaSimulator simulator;
    simulator.set_callback([&capture](const tacoma::core::TelemetryFrame& frame) {
        std::lock_guard lock(capture.mutex);
        capture.frames.push_back(frame);
    });

    simulator.advance_simulated_time(8.0);

    std::lock_guard lock(capture.mutex);
    ASSERT_GT(capture.frames.size(), 1U);
    bool found_gear_shift = false;
    for (std::size_t index = 1; index < capture.frames.size(); ++index) {
        const auto& previous = capture.frames[index - 1];
        const auto& current = capture.frames[index];
        if (current.speed_kmh > previous.speed_kmh &&
            previous.rpm - current.rpm >= 500.0) {
            found_gear_shift = true;
            break;
        }
    }
    EXPECT_TRUE(found_gear_shift);
}
