#include "tacoma/sim/DriveProfile.h"

#include <algorithm>
#include <cmath>

namespace tacoma::sim {

DriveCommand NormalDriveProfile::command_at(double elapsed_seconds,
                                             double current_speed_kmh) const {
    const double target_speed_kmh =
        elapsed_seconds < 8.0
            ? 55.0
            : 78.0 + 8.0 * std::sin((elapsed_seconds - 8.0) * 0.18);
    const double speed_error = target_speed_kmh - current_speed_kmh;
    const double throttle_pct =
        std::clamp(14.0 + speed_error * 0.55, 10.0, 55.0);

    return {
        target_speed_kmh,
        throttle_pct,
        90.0,
    };
}

}  // namespace tacoma::sim
