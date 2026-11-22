import { describe, expect, it } from "vitest"

import {
  appendTelemetryFrame,
  CHART_WINDOW_SECONDS,
  MAX_HISTORY_FRAMES,
} from "./telemetry-history"
import type { TelemetryFrame } from "@/types/telemetry"

function frame(timestamp: number): TelemetryFrame {
  return {
    timestamp,
    speedKmh: 0,
    rpm: 0,
    coolantTempC: 0,
    throttlePct: 0,
    engineLoadPct: 0,
  }
}

describe("appendTelemetryFrame", () => {
  it("enforces both the history window and the maximum frame cap", () => {
    let history: TelemetryFrame[] = []

    for (let index = 1; index <= 605; index += 1) {
      history = appendTelemetryFrame(history, frame(index / 10))
    }

    const lastFrame = history.at(-1)
    expect(history).toHaveLength(MAX_HISTORY_FRAMES)
    expect(history[0].timestamp).toBeCloseTo(0.6)
    expect(lastFrame?.timestamp).toBeCloseTo(60.5)
    if (!lastFrame) {
      throw new Error("History should retain its latest frame.")
    }
    expect(lastFrame.timestamp - history[0].timestamp).toBeLessThanOrEqual(
      CHART_WINDOW_SECONDS
    )
  })

  it("drops out-of-order frames without changing retained history", () => {
    const firstHistory = appendTelemetryFrame([], frame(5))
    const staleHistory = appendTelemetryFrame(firstHistory, frame(4))
    const nextHistory = appendTelemetryFrame(staleHistory, frame(6))

    expect(staleHistory).toBe(firstHistory)
    expect(nextHistory.map(({ timestamp }) => timestamp)).toEqual([5, 6])
  })

  it("removes frames older than the time window", () => {
    let history = appendTelemetryFrame([], frame(0))
    history = appendTelemetryFrame(history, frame(30))
    history = appendTelemetryFrame(history, frame(60))
    history = appendTelemetryFrame(history, frame(60.1))

    expect(history.map(({ timestamp }) => timestamp)).toEqual([30, 60, 60.1])
  })
})
