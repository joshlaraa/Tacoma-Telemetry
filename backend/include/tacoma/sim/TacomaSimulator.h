#pragma once

#include "tacoma/core/ITelemetrySource.h"
#include "tacoma/sim/DriveProfile.h"

#include <atomic>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <thread>

namespace tacoma::sim {

class TacomaSimulator final : public core::ITelemetrySource {
public:
    explicit TacomaSimulator(
        std::shared_ptr<const IDriveProfile> profile = nullptr);
    ~TacomaSimulator() override;

    TacomaSimulator(const TacomaSimulator&) = delete;
    TacomaSimulator& operator=(const TacomaSimulator&) = delete;

    void set_callback(core::TelemetryCallback callback) override;
    void start() override;
    void stop() override;

private:
    void run();

    const std::shared_ptr<const IDriveProfile> profile_;
    std::thread worker_;
    std::mutex lifecycle_mutex_;  // Protects worker creation and joining.
    std::mutex callback_mutex_;  // Protects the callback shared with the worker.
    std::mutex wake_mutex_;  // Coordinates timed waits with stop notifications.
    core::TelemetryCallback callback_;
    std::condition_variable wake_condition_;
    std::atomic<bool> running_{false};  // Stops the worker thread safely across threads.
};

}  // namespace tacoma::sim
