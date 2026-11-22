#pragma once

#include "tacoma/core/ITelemetrySource.h"
#include "tacoma/sim/DriveProfile.h"

#include <atomic>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <random>
#include <thread>

namespace tacoma::sim {

class TacomaSimulator final : public core::ITelemetrySource {
public:
    explicit TacomaSimulator(
        std::shared_ptr<const IDriveProfile> profile = nullptr,
        double time_scale = 1.0);
    explicit TacomaSimulator(double time_scale);
    ~TacomaSimulator() override;

    TacomaSimulator(const TacomaSimulator&) = delete;
    TacomaSimulator& operator=(const TacomaSimulator&) = delete;

    void set_callback(core::TelemetryCallback callback) override;
    void start() override;
    void stop() override;

    // Advances a stopped simulator without waiting for wall-clock time.
    void advance_simulated_time(double seconds);

private:
    core::TelemetryFrame simulate_step(double simulated_seconds);
    void deliver_frame(const core::TelemetryFrame& frame);
    void run();

    const std::shared_ptr<const IDriveProfile> profile_;
    const double time_scale_;
    std::thread worker_;
    std::mutex lifecycle_mutex_;  // Protects worker creation and joining.
    std::mutex callback_mutex_;  // Protects the callback shared with the worker.
    std::mutex wake_mutex_;  // Coordinates timed waits with stop notifications.
    std::mutex simulation_mutex_;  // Protects model state shared by worker and manual stepping.
    core::TelemetryCallback callback_;
    std::condition_variable wake_condition_;
    std::atomic<bool> running_{false};  // Stops the worker thread safely across threads.
    double simulated_time_seconds_{0.0};
    double speed_kmh_{0.0};
    double coolant_temp_c_{20.0};
    int gear_{1};
    std::mt19937 random_engine_{std::random_device{}()};
};

}  // namespace tacoma::sim
