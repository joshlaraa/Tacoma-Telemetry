#include "tacoma/sim/TacomaSimulator.h"

#include <gtest/gtest.h>

#include <chrono>
#include <condition_variable>
#include <mutex>
#include <vector>

namespace {

struct FrameCapture {
    std::mutex mutex;  // Protects frames while the simulator callback thread writes them.
    std::condition_variable condition;
    std::vector<tacoma::core::TelemetryFrame> frames;
};

void wait_for_frames(FrameCapture& capture, std::size_t count) {
    std::unique_lock lock(capture.mutex);
    ASSERT_TRUE(capture.condition.wait_for(
        lock, std::chrono::seconds{4},
        [&capture, count] { return capture.frames.size() >= count; }));
}

}  // namespace

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
