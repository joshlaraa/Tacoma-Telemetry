#include "tacoma/core/TelemetryQueue.h"
#include "tacoma/sim/TacomaSimulator.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <csignal>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <pthread.h>
#include <thread>

int main() {
    sigset_t signal_set;
    sigemptyset(&signal_set);
    sigaddset(&signal_set, SIGINT);
    // Block SIGINT in every thread so one dedicated waiter can receive it
    // synchronously; this avoids doing shutdown work inside a signal handler.
    if (pthread_sigmask(SIG_BLOCK, &signal_set, nullptr) != 0) {
        std::cerr << "failed to configure SIGINT handling\n";
        return 1;
    }

    tacoma::core::TelemetryQueue queue{32};
    const auto display_start = std::chrono::steady_clock::now();
    std::thread consumer([&queue, display_start] {
        while (const auto frame = queue.pop()) {
            const double elapsed_seconds =
                std::chrono::duration<double>(
                    frame->timestamp - display_start)
                    .count();
            std::cout << std::fixed << std::setprecision(1)
                      << "t=" << elapsed_seconds << "s"
                      << " speed=" << frame->speed_kmh << " km/h"
                      << " rpm=" << frame->rpm
                      << " coolant=" << frame->coolant_temp_c << " C"
                      << " throttle=" << frame->throttle_pct << "%"
                      << " load=" << frame->engine_load_pct << "%\n";
        }
    });

    tacoma::sim::TacomaSimulator simulator;
    // The simulator producer only enqueues here; formatting stays on the
    // consumer so a slow terminal cannot block the source callback.
    simulator.set_callback([&queue](const tacoma::core::TelemetryFrame& frame) {
        queue.push(frame);
    });

    // The signal waiter and main share this request without a data race.
    std::atomic<bool> shutdown_requested{false};
    std::mutex shutdown_mutex;
    std::condition_variable shutdown_condition;
    std::thread signal_waiter([&] {
        int received_signal = 0;
        // sigwait consumes the blocked signal without running user code from
        // an asynchronous signal context.
        // Treat a wait failure as a shutdown request too, so main cannot be
        // left waiting forever if the platform reports an unexpected error.
        (void)sigwait(&signal_set, &received_signal);
        shutdown_requested.store(true, std::memory_order_release);
        shutdown_condition.notify_one();
    });

    simulator.start();
    // SIGINT handling only records the request; main owns the ordered
    // stop-close-join sequence so the producer's final frames are retained.
    std::unique_lock shutdown_lock(shutdown_mutex);
    shutdown_condition.wait(shutdown_lock, [&] {
        return shutdown_requested.load(std::memory_order_acquire);
    });

    simulator.stop();
    queue.close();
    consumer.join();
    signal_waiter.join();
}
