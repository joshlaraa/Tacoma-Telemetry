#include "tacoma/sim/TacomaSimulator.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <random>
#include <stdexcept>
#include <utility>

namespace tacoma::sim {
namespace {

// Publish at 10 Hz. The model step is kept separate so time_scale can advance
// simulated time faster or slower without changing the public frame cadence.
constexpr auto kFramePeriod = std::chrono::milliseconds{100};
constexpr double kSimulationStepSeconds = 0.1;

// A first-order warm-up model approaches the thermostat target gradually:
// after one time constant, roughly 63% of the remaining error is gone.
constexpr double kCoolantTimeConstantSeconds = 180.0;
constexpr double kIdleRpm = 700.0;
constexpr double kRedlineRpm = 5800.0;
constexpr double kMaxSpeedKmh = 160.0;

double clamp_percent(double value) {
    return std::clamp(value, 0.0, 100.0);
}

}  // namespace

TacomaSimulator::TacomaSimulator(
    std::shared_ptr<const IDriveProfile> profile, double time_scale)
    : profile_(profile ? std::move(profile)
                       : std::make_shared<NormalDriveProfile>()),
      time_scale_(time_scale) {
    // Reject invalid timing at construction so the worker never receives a
    // negative, zero, or NaN simulation step.
    if (!std::isfinite(time_scale_) || time_scale_ <= 0.0) {
        throw std::invalid_argument("time scale must be finite and positive");
    }
}

TacomaSimulator::TacomaSimulator(double time_scale)
    : TacomaSimulator(nullptr, time_scale) {}

TacomaSimulator::~TacomaSimulator() {
    stop();
}

void TacomaSimulator::set_callback(core::TelemetryCallback callback) {
    std::lock_guard lock(callback_mutex_);
    callback_ = std::move(callback);
}

void TacomaSimulator::start() {
    std::lock_guard lock(lifecycle_mutex_);

    // exchange() makes the check-and-set one atomic operation, so concurrent
    // callers cannot start two workers for the same simulator.
    if (running_.exchange(true)) {
        return;
    }

    worker_ = std::thread(&TacomaSimulator::run, this);
}

void TacomaSimulator::stop() {
    std::lock_guard lock(lifecycle_mutex_);

    // Wake the worker immediately if it is waiting for its next deadline.
    running_.store(false);
    wake_condition_.notify_all();

    // Joining is important: after stop() returns, no worker can still access
    // this object's state or invoke a callback.
    if (worker_.joinable()) {
        worker_.join();
    }
}

void TacomaSimulator::advance_simulated_time(double seconds) {
    // Manual stepping intentionally shares the model path with the worker but
    // avoids wall-clock waiting, making long-duration tests inexpensive.
    if (!std::isfinite(seconds)) {
        throw std::invalid_argument("simulated time must be finite");
    }
    if (running_.load()) {
        throw std::logic_error(
            "advance_simulated_time requires a stopped simulator");
    }

    if (seconds <= 0.0) {
        return;
    }

    const auto full_steps = static_cast<std::size_t>(
        std::floor(seconds / kSimulationStepSeconds));
    // Use fixed-size steps for the same numerical behavior as real-time mode.
    for (std::size_t index = 0; index < full_steps; ++index) {
        deliver_frame(simulate_step(kSimulationStepSeconds));
    }

    // Preserve the caller's exact duration instead of silently dropping a
    // fractional remainder.
    const double remainder =
        seconds - static_cast<double>(full_steps) * kSimulationStepSeconds;
    if (remainder > 1e-9) {
        deliver_frame(simulate_step(remainder));
    }
}

core::TelemetryFrame TacomaSimulator::simulate_step(double simulated_seconds) {
    using clock = std::chrono::steady_clock;

    // Each distribution models a different source of imperfection: control
    // input, engine speed, coolant sensor, and load estimation respectively.
    std::uniform_real_distribution<double> control_noise{-1.5, 1.5};
    std::uniform_real_distribution<double> rpm_noise{-18.0, 18.0};
    std::uniform_real_distribution<double> temperature_noise{-0.2, 0.2};
    std::uniform_real_distribution<double> load_noise{-2.0, 2.0};

    // Gear ratios are represented by RPM per km/h. Higher gears therefore
    // produce less RPM at the same road speed.
    constexpr std::array<double, 5> rpm_per_kmh_by_gear{
        145.0, 95.0, 65.0, 48.0, 38.0};

    // Separate upshift/downshift thresholds provide hysteresis and prevent
    // gear hunting when speed hovers near a boundary.
    constexpr std::array<double, 4> upshift_speed_kmh{
        20.0, 38.0, 62.0, 90.0};
    constexpr std::array<double, 4> downshift_speed_kmh{
        14.0, 29.0, 50.0, 76.0};

    std::lock_guard simulation_lock(simulation_mutex_);
    const auto now = clock::now();
    const DriveCommand command =
        profile_->command_at(simulated_time_seconds_, speed_kmh_);

    const double target_speed_kmh =
        std::clamp(command.target_speed_kmh, 0.0, kMaxSpeedKmh);
    const double throttle_pct =
        clamp_percent(command.throttle_pct + control_noise(random_engine_));

    // Acceleration responds to both speed error and throttle, then is bounded
    // to keep the fake vehicle within plausible limits.
    const double acceleration_kmh_per_second = std::clamp(
        (target_speed_kmh - speed_kmh_) * 0.45 +
            (throttle_pct - 12.0) * 0.04,
        -4.0, 5.0);
    speed_kmh_ = std::clamp(
        speed_kmh_ + acceleration_kmh_per_second * simulated_seconds,
        0.0, kMaxSpeedKmh);

    // The while loops also handle a large time step that crosses multiple
    // thresholds, rather than assuming every step advances exactly one gear.
    while (gear_ < 5 && speed_kmh_ > upshift_speed_kmh[gear_ - 1]) {
        ++gear_;
    }
    while (gear_ > 1 && speed_kmh_ < downshift_speed_kmh[gear_ - 2]) {
        --gear_;
    }

    // RPM falls after an upshift because the selected gear has a lower
    // RPM-per-speed ratio. Noise keeps output from looking perfectly synthetic.
    const double rpm = std::clamp(
        kIdleRpm +
            speed_kmh_ * rpm_per_kmh_by_gear[gear_ - 1] *
                (0.78 + throttle_pct / 220.0) +
            rpm_noise(random_engine_),
        kIdleRpm - 35.0, kRedlineRpm);

    const double coolant_target_c =
        std::clamp(command.coolant_target_c, 88.0, 92.0);
    const double warmup_fraction =
        1.0 - std::exp(-simulated_seconds / kCoolantTimeConstantSeconds);

    // Move only partway toward the target each step. This exponential response
    // models warm-up without pretending the thermostat changes temperature
    // instantaneously.
    coolant_temp_c_ +=
        (coolant_target_c - coolant_temp_c_) * warmup_fraction;

    // Load is an intentionally simple estimate for the dashboard, not a
    // substitute for a real ECU load PID.
    const double engine_load_pct = clamp_percent(
        12.0 + throttle_pct * 0.72 + (speed_kmh_ > 1.0 ? 8.0 : 0.0) +
        load_noise(random_engine_));

    simulated_time_seconds_ += simulated_seconds;

    return {
        now,
        rpm,
        // Report small measurement noise separately from the internal state.
        std::clamp(speed_kmh_ + control_noise(random_engine_) * 0.1,
                   0.0, kMaxSpeedKmh),
        std::clamp(coolant_temp_c_ + temperature_noise(random_engine_),
                   0.0, 110.0),
        throttle_pct,
        engine_load_pct,
    };
}

void TacomaSimulator::deliver_frame(const core::TelemetryFrame& frame) {
    core::TelemetryCallback callback;
    {
        // Copy under the mutex, then invoke outside it. User callbacks may be
        // slow or call set_callback(), neither of which should hold this lock.
        std::lock_guard lock(callback_mutex_);
        callback = callback_;
    }
    if (callback) {
        callback(frame);
    }
}

void TacomaSimulator::run() {
    using clock = std::chrono::steady_clock;

    auto next_frame = clock::now();
    while (running_.load()) {
        // The callback runs on this worker thread. The immediate first frame
        // avoids making startup wait for one full period.
        deliver_frame(
            simulate_step(kSimulationStepSeconds * time_scale_));

        next_frame += kFramePeriod;
        std::unique_lock wait_lock(wake_mutex_);
        // Waiting until an absolute deadline avoids accumulating drift from
        // the duration of simulation and callback work.
        wake_condition_.wait_until(
            wait_lock, next_frame, [this] { return !running_.load(); });
    }
}

}  // namespace tacoma::sim
