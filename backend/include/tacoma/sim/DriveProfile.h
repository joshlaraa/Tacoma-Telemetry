#pragma once

namespace tacoma::sim {

// A profile describes driver intent; TacomaSimulator is responsible for
// translating that intent into vehicle state and telemetry.
struct DriveCommand {
    double target_speed_kmh{0.0};  // Requested speed in km/h.
    double throttle_pct{0.0};  // Requested throttle position in percent.
    double coolant_target_c{90.0};  // Desired regulated coolant temperature in C.
};

// Strategy interface for replacing the simulator's driving scenario without
// coupling route decisions to the vehicle-response model.
class IDriveProfile {
public:
    virtual ~IDriveProfile() = default;

    // Returns the next driver request for simulated time and current speed.
    virtual DriveCommand command_at(double elapsed_seconds,
                                     double current_speed_kmh) const = 0;
};

// Default profile: accelerate to a highway-like speed, then vary cruise speed
// gently to make the generated telemetry look less artificial.
class NormalDriveProfile final : public IDriveProfile {
public:
    DriveCommand command_at(double elapsed_seconds,
                            double current_speed_kmh) const override;
};

}  // namespace tacoma::sim
