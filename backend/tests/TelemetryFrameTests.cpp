#include "tacoma/core/TelemetryFrame.h"

#include <gtest/gtest.h>

// The frame is intentionally a lightweight value type, so these tests focus
// on aggregate initialization and the documented default values.
TEST(TelemetryFrameTest, StoresObdNativeValues) {
    const auto timestamp = std::chrono::steady_clock::now();
    const tacoma::core::TelemetryFrame frame{
        timestamp,
        1850.0,
        42.5,
        88.0,
        24.0,
        31.0,
    };

    EXPECT_EQ(frame.timestamp, timestamp);
    EXPECT_DOUBLE_EQ(frame.rpm, 1850.0);
    EXPECT_DOUBLE_EQ(frame.speed_kmh, 42.5);
    EXPECT_DOUBLE_EQ(frame.coolant_temp_c, 88.0);
    EXPECT_DOUBLE_EQ(frame.throttle_pct, 24.0);
    EXPECT_DOUBLE_EQ(frame.engine_load_pct, 31.0);
}

// Defaults make a newly allocated frame safe to display before a source has
// produced its first measurement.
TEST(TelemetryFrameTest, HasSensibleDefaults) {
    const tacoma::core::TelemetryFrame frame;

    EXPECT_EQ(frame.timestamp, std::chrono::steady_clock::time_point{});
    EXPECT_DOUBLE_EQ(frame.rpm, 0.0);
    EXPECT_DOUBLE_EQ(frame.speed_kmh, 0.0);
    EXPECT_DOUBLE_EQ(frame.coolant_temp_c, 20.0);
    EXPECT_DOUBLE_EQ(frame.throttle_pct, 0.0);
    EXPECT_DOUBLE_EQ(frame.engine_load_pct, 0.0);
}
