#pragma once

#include "tacoma/core/TelemetryFrame.h"

#include <condition_variable>
#include <cstddef>
#include <deque>
#include <mutex>
#include <optional>

namespace tacoma::core {

// A bounded FIFO for TelemetryFrame values. Frames retain their OBD-native
// units: km/h, degrees Celsius, rpm, and percent.
//
// push() never blocks. When the queue is full, it removes the oldest frame
// before adding the new one and increments droppedCount(). Once close() has
// been called, pushes are ignored.
//
// pop() blocks until a frame is available or the queue is both closed and
// empty. tryPop() never blocks. close() preserves queued frames, wakes every
// blocked reader, and makes later empty pops return std::nullopt.
class TelemetryQueue final {
public:
    explicit TelemetryQueue(std::size_t capacity);

    TelemetryQueue(const TelemetryQueue&) = delete;
    TelemetryQueue& operator=(const TelemetryQueue&) = delete;
    TelemetryQueue(TelemetryQueue&&) = delete;
    TelemetryQueue& operator=(TelemetryQueue&&) = delete;

    // Enqueues frame without waiting. A full queue drops its oldest frame.
    void push(TelemetryFrame frame);

    // Waits for a frame, unless the closed queue has been drained.
    std::optional<TelemetryFrame> pop();

    // Returns immediately with the next frame, or std::nullopt if none exists.
    std::optional<TelemetryFrame> tryPop();

    // Closes the queue while allowing already-enqueued frames to be drained.
    void close();

    std::size_t size() const;
    std::size_t droppedCount() const;
    bool isClosed() const;

private:
    const std::size_t capacity_;
    std::deque<TelemetryFrame> frames_;
    mutable std::mutex mutex_;  // Protects all queue state shared by threads.
    std::condition_variable readers_;
    bool closed_{false};
    std::size_t dropped_count_{0};
};

}  // namespace tacoma::core
