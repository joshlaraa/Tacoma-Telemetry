#pragma once

namespace tacoma::sim {

struct DriveCommand {
    double target_speed_kmh{0.0};
    double throttle_pct{0.0};
    double coolant_target_c{90.0};
};

class IDriveProfile {
public:
    virtual ~IDriveProfile() = default;

    virtual DriveCommand command_at(double elapsed_seconds,
                                     double current_speed_kmh) const = 0;
};

class NormalDriveProfile final : public IDriveProfile {
public:
    DriveCommand command_at(double elapsed_seconds,
                            double current_speed_kmh) const override;
};

}  // namespace tacoma::sim
