#pragma once

#include <chrono>

namespace tacoma::core {

// The backend keeps telemetry in the units used by OBD-II and converts units
// only at presentation boundaries, such as the future React dashboard.
struct TelemetryFrame {
    // steady_clock is monotonic, so elapsed-time calculations are not affected
    // by wall-clock adjustments.
    std::chrono::steady_clock::time_point timestamp{};
    double rpm{0.0};  // Engine speed in revolutions per minute.
    double speed_kmh{0.0};  // Vehicle speed in kilometers per hour.
    double coolant_temp_c{20.0};  // Coolant temperature in degrees Celsius.
    double throttle_pct{0.0};  // Throttle position as a percentage.
    double engine_load_pct{0.0};  // Estimated engine load as a percentage.
};

}  // namespace tacoma::core
