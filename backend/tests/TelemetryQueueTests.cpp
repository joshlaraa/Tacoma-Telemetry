#include "tacoma/core/TelemetryQueue.h"

#include <gtest/gtest.h>

#include <chrono>
#include <future>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <vector>

namespace {

using tacoma::core::TelemetryFrame;
using tacoma::core::TelemetryQueue;

constexpr auto kTestTimeout = std::chrono::seconds{5};

static_assert(!std::is_copy_constructible_v<TelemetryQueue>);
static_assert(!std::is_copy_assignable_v<TelemetryQueue>);
static_assert(!std::is_move_constructible_v<TelemetryQueue>);
static_assert(!std::is_move_assignable_v<TelemetryQueue>);

TelemetryFrame frame_with_marker(double marker) {
    TelemetryFrame frame;
    frame.rpm = marker;
    return frame;
}

}  // namespace

TEST(TelemetryQueueTest, RejectsZeroCapacity) {
    EXPECT_THROW(TelemetryQueue queue{0}, std::invalid_argument);
}

TEST(TelemetryQueueTest, PreservesFifoOrder) {
    TelemetryQueue queue{3};
    queue.push(frame_with_marker(1.0));
    queue.push(frame_with_marker(2.0));
    queue.push(frame_with_marker(3.0));

    for (double expected : {1.0, 2.0, 3.0}) {
        const auto frame = queue.tryPop();
        ASSERT_TRUE(frame.has_value());
        EXPECT_DOUBLE_EQ(frame->rpm, expected);
    }
    EXPECT_EQ(queue.size(), 0U);
}

TEST(TelemetryQueueTest, TryPopOnEmptyReturnsNullopt) {
    TelemetryQueue queue{1};

    EXPECT_FALSE(queue.tryPop().has_value());
    EXPECT_EQ(queue.size(), 0U);
}

TEST(TelemetryQueueTest, FullQueueDropsOldestAndKeepsNewestFrames) {
    TelemetryQueue queue{2};
    queue.push(frame_with_marker(1.0));
    queue.push(frame_with_marker(2.0));
    queue.push(frame_with_marker(3.0));

    EXPECT_EQ(queue.droppedCount(), 1U);

    const auto first = queue.tryPop();
    const auto second = queue.tryPop();
    ASSERT_TRUE(first.has_value());
    ASSERT_TRUE(second.has_value());
    EXPECT_DOUBLE_EQ(first->rpm, 2.0);
    EXPECT_DOUBLE_EQ(second->rpm, 3.0);
}

TEST(TelemetryQueueTest, PopBlocksUntilAnotherThreadPushes) {
    TelemetryQueue queue{1};
    std::promise<void> reader_ready;
    std::promise<std::optional<TelemetryFrame>> result_promise;
    auto reader_ready_future = reader_ready.get_future();
    auto result_future = result_promise.get_future();

    std::thread reader([&] {
        // The promise lets the test arrange the producer after the reader has
        // reached the blocking call, without relying on a wall-clock sleep.
        reader_ready.set_value();
        result_promise.set_value(queue.pop());
    });

    const bool reader_started =
        reader_ready_future.wait_for(kTestTimeout) == std::future_status::ready;
    queue.push(frame_with_marker(42.0));
    const bool reader_finished =
        result_future.wait_for(kTestTimeout) == std::future_status::ready;
    if (!reader_finished) {
        queue.close();
    }
    reader.join();

    ASSERT_TRUE(reader_started);
    ASSERT_TRUE(reader_finished);
    const auto result = result_future.get();
    ASSERT_TRUE(result.has_value());
    EXPECT_DOUBLE_EQ(result->rpm, 42.0);
}

TEST(TelemetryQueueTest, CloseWakesBlockedReaderWithNullopt) {
    TelemetryQueue queue{1};
    std::promise<void> reader_ready;
    std::promise<std::optional<TelemetryFrame>> result_promise;
    auto reader_ready_future = reader_ready.get_future();
    auto result_future = result_promise.get_future();

    std::thread reader([&] {
        reader_ready.set_value();
        result_promise.set_value(queue.pop());
    });

    const bool reader_started =
        reader_ready_future.wait_for(kTestTimeout) == std::future_status::ready;
    queue.close();
    const bool reader_finished =
        result_future.wait_for(kTestTimeout) == std::future_status::ready;
    reader.join();

    ASSERT_TRUE(reader_started);
    ASSERT_TRUE(reader_finished);
    EXPECT_FALSE(result_future.get().has_value());
    EXPECT_TRUE(queue.isClosed());
}

TEST(TelemetryQueueTest, CloseDrainsQueuedFramesThenRejectsPushes) {
    TelemetryQueue queue{2};
    queue.push(frame_with_marker(1.0));
    queue.push(frame_with_marker(2.0));
    queue.close();
    queue.close();
    queue.push(frame_with_marker(3.0));

    const auto first = queue.pop();
    const auto second = queue.pop();
    const auto finished = queue.tryPop();

    ASSERT_TRUE(first.has_value());
    ASSERT_TRUE(second.has_value());
    EXPECT_DOUBLE_EQ(first->rpm, 1.0);
    EXPECT_DOUBLE_EQ(second->rpm, 2.0);
    EXPECT_FALSE(finished.has_value());
    EXPECT_EQ(queue.size(), 0U);
    EXPECT_EQ(queue.droppedCount(), 0U);
}

TEST(TelemetryQueueTest, CloseWakesAllBlockedReaders) {
    constexpr std::size_t reader_count = 4;
    TelemetryQueue queue{1};
    std::vector<std::promise<void>> reader_ready_promises(reader_count);
    std::vector<std::future<void>> reader_ready_futures;
    std::vector<std::promise<std::optional<TelemetryFrame>>> result_promises(
        reader_count);
    std::vector<std::future<std::optional<TelemetryFrame>>> result_futures;
    std::vector<std::thread> readers;
    reader_ready_futures.reserve(reader_count);
    result_futures.reserve(reader_count);
    readers.reserve(reader_count);

    for (std::size_t index = 0; index < reader_count; ++index) {
        reader_ready_futures.push_back(
            reader_ready_promises[index].get_future());
        result_futures.push_back(result_promises[index].get_future());
        readers.emplace_back([&, index] {
            reader_ready_promises[index].set_value();
            result_promises[index].set_value(queue.pop());
        });
    }

    bool all_readers_started = true;
    for (auto& reader_ready_future : reader_ready_futures) {
        all_readers_started &=
            reader_ready_future.wait_for(kTestTimeout) ==
            std::future_status::ready;
    }
    queue.close();

    bool all_readers_finished = true;
    for (auto& result_future : result_futures) {
        all_readers_finished &=
            result_future.wait_for(kTestTimeout) == std::future_status::ready;
    }
    for (auto& reader : readers) {
        reader.join();
    }

    EXPECT_TRUE(all_readers_started);
    EXPECT_TRUE(all_readers_finished);
    for (auto& result_future : result_futures) {
        EXPECT_FALSE(result_future.get().has_value());
    }
}

TEST(TelemetryQueueTest, SingleProducerConsumerPreservesOneHundredThousandFrames) {
    constexpr std::size_t frame_count = 100'000;
    TelemetryQueue queue{frame_count};
    std::vector<double> received;
    received.reserve(frame_count);

    std::thread consumer([&] {
        while (const auto frame = queue.pop()) {
            received.push_back(frame->rpm);
        }
    });
    std::thread producer([&] {
        for (std::size_t index = 0; index < frame_count; ++index) {
            queue.push(frame_with_marker(static_cast<double>(index)));
        }
    });

    producer.join();
    queue.close();
    consumer.join();

    ASSERT_EQ(queue.droppedCount(), 0U);
    ASSERT_EQ(received.size(), frame_count);
    for (std::size_t index = 0; index < frame_count; ++index) {
        EXPECT_DOUBLE_EQ(received[index], static_cast<double>(index));
    }
}

TEST(TelemetryQueueTest, MultipleProducersDeliverEveryFrameInPerProducerOrder) {
    constexpr std::size_t producer_count = 4;
    constexpr std::size_t frames_per_producer = 25'000;
    constexpr std::size_t total_frames = producer_count * frames_per_producer;
    TelemetryQueue queue{total_frames};
    std::vector<double> received;
    received.reserve(total_frames);

    std::thread consumer([&] {
        while (const auto frame = queue.pop()) {
            received.push_back(frame->rpm);
        }
    });

    std::vector<std::thread> producers;
    producers.reserve(producer_count);
    for (std::size_t producer_id = 0; producer_id < producer_count;
         ++producer_id) {
        producers.emplace_back([&, producer_id] {
            for (std::size_t sequence = 0; sequence < frames_per_producer;
                 ++sequence) {
                // Encoding both values in one field gives every test frame a
                // unique producer/sequence identity without changing the API.
                const auto id =
                    producer_id * frames_per_producer + sequence;
                queue.push(frame_with_marker(static_cast<double>(id)));
            }
        });
    }

    for (auto& producer : producers) {
        producer.join();
    }
    queue.close();
    consumer.join();

    ASSERT_EQ(queue.droppedCount(), 0U);
    ASSERT_EQ(received.size(), total_frames);

    std::vector<std::size_t> next_sequence(producer_count, 0);
    std::vector<bool> seen(total_frames, false);
    for (const double encoded_id : received) {
        const auto id = static_cast<std::size_t>(encoded_id);
        ASSERT_LT(id, total_frames);
        EXPECT_FALSE(seen[id]);
        seen[id] = true;

        const auto producer_id = id / frames_per_producer;
        const auto sequence = id % frames_per_producer;
        ASSERT_LT(producer_id, producer_count);
        EXPECT_EQ(sequence, next_sequence[producer_id]);
        ++next_sequence[producer_id];
    }

    for (const bool frame_was_seen : seen) {
        EXPECT_TRUE(frame_was_seen);
    }
    for (const auto sequence : next_sequence) {
        EXPECT_EQ(sequence, frames_per_producer);
    }
}
