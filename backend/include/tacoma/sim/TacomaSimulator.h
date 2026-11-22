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

// Produces plausible Tacoma telemetry on a worker thread. The model can also
// be advanced synchronously, which lets tests cover long drives without sleep.
class TacomaSimulator final : public core::ITelemetrySource {
public:
    // A null profile selects NormalDriveProfile. time_scale controls how much
    // simulated time each real-time frame advances and must be positive.
    explicit TacomaSimulator(
        std::shared_ptr<const IDriveProfile> profile = nullptr,
        double time_scale = 1.0);

    explicit TacomaSimulator(double time_scale);
    ~TacomaSimulator() override;

    TacomaSimulator(const TacomaSimulator&) = delete;
    TacomaSimulator& operator=(const TacomaSimulator&) = delete;

    // The callback executes on the simulator worker thread.
    void set_callback(core::TelemetryCallback callback) override;

    // start() is idempotent; calling it while already running has no effect.
    void start() override;

    // stop() is synchronous and joins the worker before returning. Call it
    // from outside the callback; a worker cannot join itself.
    void stop() override;

    // Advances a stopped simulator without waiting for wall-clock time.
    // This method is intended for deterministic, fast-running model tests and
    // must not race with start() or another manual-step caller.
    void advance_simulated_time(double seconds);

private:
    core::TelemetryFrame simulate_step(double simulated_seconds);
    void deliver_frame(const core::TelemetryFrame& frame);
    void run();

    const std::shared_ptr<const IDriveProfile> profile_;  // Immutable strategy.
    const double time_scale_;  // Simulated seconds advanced per real-time second.
    std::thread worker_;
    std::mutex lifecycle_mutex_;  // Protects worker creation and joining.
    std::mutex callback_mutex_;  // Protects the callback shared with the worker.
    std::mutex wake_mutex_;  // Coordinates timed waits with stop notifications.
    std::mutex simulation_mutex_;  // Protects model state shared by worker and manual stepping.
    core::TelemetryCallback callback_;
    std::condition_variable wake_condition_;
    std::atomic<bool> running_{false};  // Stops the worker thread safely across threads.
    double simulated_time_seconds_{0.0};  // Model time, independent of wall time.
    double speed_kmh_{0.0};  // Internal vehicle speed in km/h.
    double coolant_temp_c_{20.0};  // Internal coolant state in degrees Celsius.
    int gear_{1};  // Automatic transmission gear, constrained to 1..5.
    std::mt19937 random_engine_{std::random_device{}()};  // Sensor/control noise.
};

}  // namespace tacoma::sim
