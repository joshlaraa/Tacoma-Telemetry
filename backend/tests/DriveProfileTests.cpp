#include "tacoma/sim/DriveProfile.h"

#include <gtest/gtest.h>

// This is a contract-level test: it verifies the two important phases of the
// default scenario without coupling the test to simulator internals.
TEST(NormalDriveProfileTest, RequestsAProgressiveDrive) {
    const tacoma::sim::NormalDriveProfile profile;

    const auto launch = profile.command_at(0.0, 0.0);
    EXPECT_DOUBLE_EQ(launch.target_speed_kmh, 55.0);
    EXPECT_GE(launch.throttle_pct, 10.0);
    EXPECT_LE(launch.throttle_pct, 55.0);
    EXPECT_DOUBLE_EQ(launch.coolant_target_c, 90.0);

    const auto cruise = profile.command_at(8.0, 78.0);
    EXPECT_DOUBLE_EQ(cruise.target_speed_kmh, 78.0);
    EXPECT_NEAR(cruise.throttle_pct, 14.0, 1.0);
}
