#pragma once

#include <chrono>

namespace tacoma::core {

struct TelemetryFrame {
    std::chrono::steady_clock::time_point timestamp{};
    double rpm{0.0};
    double speed_kmh{0.0};
    double coolant_temp_c{20.0};
    double throttle_pct{0.0};
    double engine_load_pct{0.0};
};

}  // namespace tacoma::core
