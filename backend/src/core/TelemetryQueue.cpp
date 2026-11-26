#include "tacoma/core/TelemetryQueue.h"

#include <stdexcept>
#include <utility>

namespace tacoma::core {

TelemetryQueue::TelemetryQueue(std::size_t capacity) : capacity_(capacity) {
    if (capacity_ == 0) {
        throw std::invalid_argument("telemetry queue capacity must be positive");
    }
}

void TelemetryQueue::push(TelemetryFrame frame) {
    {
        std::lock_guard lock(mutex_);
        if (closed_) {
            return;
        }

        if (frames_.size() == capacity_) {
            // Dropping the oldest value preserves the newest sensor reading,
            // which is more useful to a live telemetry consumer.
            frames_.pop_front();
            ++dropped_count_;
        }
        frames_.push_back(std::move(frame));
    }

    // Notify after releasing the mutex so a reader can acquire it immediately
    // instead of waiting for this producer to finish its critical section.
    readers_.notify_one();
}

std::optional<TelemetryFrame> TelemetryQueue::pop() {
    std::unique_lock lock(mutex_);
    // The predicate handles spurious wakeups and lets close wake readers even
    // when no frame remains to deliver.
    readers_.wait(lock, [this] { return !frames_.empty() || closed_; });

    if (frames_.empty()) {
        return std::nullopt;
    }

    std::optional<TelemetryFrame> frame{std::move(frames_.front())};
    frames_.pop_front();
    return frame;
}

std::optional<TelemetryFrame> TelemetryQueue::tryPop() {
    std::lock_guard lock(mutex_);
    if (frames_.empty()) {
        return std::nullopt;
    }

    std::optional<TelemetryFrame> frame{std::move(frames_.front())};
    frames_.pop_front();
    return frame;
}

void TelemetryQueue::close() {
    {
        std::lock_guard lock(mutex_);
        if (closed_) {
            return;
        }

        // Set the state while holding the same mutex used by pop()'s
        // predicate, then notify all so every blocked reader can re-check it.
        closed_ = true;
    }
    readers_.notify_all();
}

std::size_t TelemetryQueue::size() const {
    std::lock_guard lock(mutex_);
    return frames_.size();
}

std::size_t TelemetryQueue::droppedCount() const {
    std::lock_guard lock(mutex_);
    return dropped_count_;
}

bool TelemetryQueue::isClosed() const {
    std::lock_guard lock(mutex_);
    return closed_;
}

}  // namespace tacoma::core
