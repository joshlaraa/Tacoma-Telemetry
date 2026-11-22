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

constexpr auto kFramePeriod = std::chrono::milliseconds{100};
constexpr double kSimulationStepSeconds = 0.1;
constexpr double kCoolantTimeConstantSeconds = 210.0;
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
    if (running_.exchange(true)) {
        return;
    }

    worker_ = std::thread(&TacomaSimulator::run, this);
}

void TacomaSimulator::stop() {
    std::lock_guard lock(lifecycle_mutex_);
    running_.store(false);
    wake_condition_.notify_all();

    if (worker_.joinable()) {
        worker_.join();
    }
}

void TacomaSimulator::advance_simulated_time(double seconds) {
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
    for (std::size_t index = 0; index < full_steps; ++index) {
        deliver_frame(simulate_step(kSimulationStepSeconds));
    }

    const double remainder =
        seconds - static_cast<double>(full_steps) * kSimulationStepSeconds;
    if (remainder > 1e-9) {
        deliver_frame(simulate_step(remainder));
    }
}

core::TelemetryFrame TacomaSimulator::simulate_step(double simulated_seconds) {
    using clock = std::chrono::steady_clock;

    std::uniform_real_distribution<double> control_noise{-1.5, 1.5};
    std::uniform_real_distribution<double> rpm_noise{-18.0, 18.0};
    std::uniform_real_distribution<double> temperature_noise{-0.2, 0.2};
    std::uniform_real_distribution<double> load_noise{-2.0, 2.0};

    constexpr std::array<double, 5> rpm_per_kmh_by_gear{
        145.0, 95.0, 65.0, 48.0, 38.0};
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
    const double acceleration_kmh_per_second = std::clamp(
        (target_speed_kmh - speed_kmh_) * 0.45 +
            (throttle_pct - 12.0) * 0.04,
        -4.0, 5.0);
    speed_kmh_ = std::clamp(
        speed_kmh_ + acceleration_kmh_per_second * simulated_seconds,
        0.0, kMaxSpeedKmh);

    while (gear_ < 5 && speed_kmh_ > upshift_speed_kmh[gear_ - 1]) {
        ++gear_;
    }
    while (gear_ > 1 && speed_kmh_ < downshift_speed_kmh[gear_ - 2]) {
        --gear_;
    }

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
    coolant_temp_c_ +=
        (coolant_target_c - coolant_temp_c_) * warmup_fraction;

    const double engine_load_pct = clamp_percent(
        12.0 + throttle_pct * 0.72 + (speed_kmh_ > 1.0 ? 8.0 : 0.0) +
        load_noise(random_engine_));

    simulated_time_seconds_ += simulated_seconds;

    return {
        now,
        rpm,
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
        deliver_frame(
            simulate_step(kSimulationStepSeconds * time_scale_));

        next_frame += kFramePeriod;
        std::unique_lock wait_lock(wake_mutex_);
        wake_condition_.wait_until(
            wait_lock, next_frame, [this] { return !running_.load(); });
    }
}

}  // namespace tacoma::sim
