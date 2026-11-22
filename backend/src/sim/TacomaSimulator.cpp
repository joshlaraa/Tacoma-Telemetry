#include "tacoma/sim/TacomaSimulator.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <random>
#include <utility>

namespace tacoma::sim {
namespace {

constexpr auto kFramePeriod = std::chrono::milliseconds{100};
constexpr double kIdleRpm = 700.0;
constexpr double kRedlineRpm = 5800.0;
constexpr double kMaxSpeedKmh = 160.0;

double clamp_percent(double value) {
    return std::clamp(value, 0.0, 100.0);
}

}  // namespace

TacomaSimulator::TacomaSimulator(
    std::shared_ptr<const IDriveProfile> profile)
    : profile_(profile ? std::move(profile)
                       : std::make_shared<NormalDriveProfile>()) {}

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

void TacomaSimulator::run() {
    using clock = std::chrono::steady_clock;

    std::mt19937 random_engine{std::random_device{}()};
    std::uniform_real_distribution<double> control_noise{-1.5, 1.5};
    std::uniform_real_distribution<double> rpm_noise{-18.0, 18.0};
    std::uniform_real_distribution<double> temperature_noise{-0.2, 0.2};
    std::uniform_real_distribution<double> load_noise{-2.0, 2.0};

    const auto simulation_start = clock::now();
    auto next_frame = simulation_start;
    double speed_kmh = 0.0;
    double coolant_temp_c = 20.0;
    int gear = 1;

    constexpr std::array<double, 5> rpm_per_kmh_by_gear{
        145.0, 95.0, 65.0, 48.0, 38.0};
    constexpr std::array<double, 4> upshift_speed_kmh{
        20.0, 38.0, 62.0, 90.0};
    constexpr std::array<double, 4> downshift_speed_kmh{
        14.0, 29.0, 50.0, 76.0};

    while (running_.load()) {
        const auto now = clock::now();
        const double elapsed_seconds =
            std::chrono::duration<double>(now - simulation_start).count();
        const DriveCommand command =
            profile_->command_at(elapsed_seconds, speed_kmh);

        const double target_speed_kmh =
            std::clamp(command.target_speed_kmh, 0.0, kMaxSpeedKmh);
        const double throttle_pct =
            clamp_percent(command.throttle_pct + control_noise(random_engine));
        const double acceleration_kmh_per_second = std::clamp(
            (target_speed_kmh - speed_kmh) * 0.45 +
                (throttle_pct - 12.0) * 0.04,
            -4.0, 5.0);
        speed_kmh = std::clamp(
            speed_kmh + acceleration_kmh_per_second * 0.1, 0.0, kMaxSpeedKmh);

        while (gear < 5 && speed_kmh > upshift_speed_kmh[gear - 1]) {
            ++gear;
        }
        while (gear > 1 && speed_kmh < downshift_speed_kmh[gear - 2]) {
            --gear;
        }

        const double rpm = std::clamp(
            kIdleRpm +
                speed_kmh * rpm_per_kmh_by_gear[gear - 1] *
                    (0.78 + throttle_pct / 220.0) +
                rpm_noise(random_engine),
            kIdleRpm - 35.0, kRedlineRpm);

        const double coolant_target_c =
            std::clamp(command.coolant_target_c, 70.0, 105.0);
        const double warmup_rate_c_per_second = 4.0 + throttle_pct * 0.025;
        if (coolant_temp_c < coolant_target_c) {
            coolant_temp_c = std::min(
                coolant_target_c,
                coolant_temp_c + warmup_rate_c_per_second * 0.1);
        } else {
            coolant_temp_c =
                std::max(coolant_target_c, coolant_temp_c - 1.0 * 0.1);
        }

        const double engine_load_pct = clamp_percent(
            12.0 + throttle_pct * 0.72 + (speed_kmh > 1.0 ? 8.0 : 0.0) +
            load_noise(random_engine));

        core::TelemetryFrame frame{
            now,
            rpm,
            std::clamp(speed_kmh + control_noise(random_engine) * 0.1,
                       0.0, kMaxSpeedKmh),
            std::clamp(coolant_temp_c + temperature_noise(random_engine),
                       0.0, 110.0),
            throttle_pct,
            engine_load_pct,
        };

        core::TelemetryCallback callback;
        {
            std::lock_guard lock(callback_mutex_);
            callback = callback_;
        }
        if (callback) {
            callback(frame);
        }

        next_frame += kFramePeriod;
        std::unique_lock wait_lock(wake_mutex_);
        wake_condition_.wait_until(
            wait_lock, next_frame, [this] { return !running_.load(); });
    }
}

}  // namespace tacoma::sim
