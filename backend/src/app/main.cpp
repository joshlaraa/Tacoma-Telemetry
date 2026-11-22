#include "tacoma/sim/TacomaSimulator.h"

#include <chrono>
#include <iomanip>
#include <iostream>
#include <thread>

int main() {
    // Phase 1 uses the simulator and terminal output. Later phases can keep
    // this source contract while replacing the output callback with transport.
    tacoma::sim::TacomaSimulator simulator;
    const auto display_start = std::chrono::steady_clock::now();

    // Callbacks execute on the simulator worker thread, so this demo only does
    // short, synchronous formatting work here.
    simulator.set_callback([display_start](const tacoma::core::TelemetryFrame& frame) {
        const double elapsed_seconds =
            std::chrono::duration<double>(frame.timestamp - display_start).count();
        std::cout << std::fixed << std::setprecision(1)
                  << "t=" << elapsed_seconds << "s"
                  << " speed=" << frame.speed_kmh << " km/h"
                  << " rpm=" << frame.rpm
                  << " coolant=" << frame.coolant_temp_c << " C"
                  << " throttle=" << frame.throttle_pct << "%"
                  << " load=" << frame.engine_load_pct << "%\n";
    });

    simulator.start();
    // Keep the process alive while the simulator publishes its 10 Hz stream.
    std::this_thread::sleep_for(std::chrono::seconds{10});
    simulator.stop();
}
