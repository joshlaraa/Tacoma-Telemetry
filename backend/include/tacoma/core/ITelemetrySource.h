#pragma once

#include "tacoma/core/TelemetryFrame.h"

#include <functional>

namespace tacoma::core {

using TelemetryCallback = std::function<void(const TelemetryFrame&)>;

class ITelemetrySource {
public:
    virtual ~ITelemetrySource() = default;

    virtual void set_callback(TelemetryCallback callback) = 0;
    virtual void start() = 0;
    virtual void stop() = 0;
};

}  // namespace tacoma::core
