import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MockTelemetrySource } from "./telemetry-source"

describe("MockTelemetrySource", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps timestamps increasing across scenario switches", () => {
    const timestamps: number[] = []
    const source = new MockTelemetrySource()
    const unsubscribe = source.subscribe((frame) => {
      timestamps.push(frame.timestamp)
    })

    vi.advanceTimersByTime(300)
    source.setMode("mountain")
    vi.advanceTimersByTime(300)
    source.setMode("normal")
    vi.advanceTimersByTime(300)
    unsubscribe()

    expect(timestamps.length).toBe(10)
    timestamps.slice(1).forEach((timestamp, index) => {
      expect(timestamp).toBeGreaterThan(timestamps[index])
    })
  })
})
