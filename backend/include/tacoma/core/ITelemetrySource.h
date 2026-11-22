#pragma once

#include "tacoma/core/TelemetryFrame.h"

#include <functional>

namespace tacoma::core {

// Sources invoke callbacks on their producing thread. Consumers that retain
// or aggregate frames are responsible for synchronizing their own state.
using TelemetryCallback = std::function<void(const TelemetryFrame&)>;

// Common lifecycle and delivery contract for simulated and hardware sources.
class ITelemetrySource {
public:
    virtual ~ITelemetrySource() = default;

    // Replaces the callback. Passing an empty callback disables delivery.
    virtual void set_callback(TelemetryCallback callback) = 0;

    // Starts producing frames. Implementations should make repeated calls safe.
    virtual void start() = 0;

    // Stops production and returns only after the producer has shut down.
    virtual void stop() = 0;
};

}  // namespace tacoma::core
