import { describe, expect, it } from "vitest"

import { toDisplayUnits, type TelemetryFrame } from "./telemetry"

describe("toDisplayUnits", () => {
  it("keeps native values and units in metric mode", () => {
    const frame: TelemetryFrame = {
      timestamp: 12.5,
      speedKmh: 100,
      rpm: 2500,
      coolantTempC: 90,
      throttlePct: 30,
      engineLoadPct: 45,
    }

    expect(toDisplayUnits(frame, "metric")).toEqual({
      timestamp: 12.5,
      speed: 100,
      speedUnit: "km/h",
      coolantTemp: 90,
      coolantUnit: "°C",
      rpm: 2500,
      throttlePct: 30,
      engineLoadPct: 45,
    })
  })

  it("converts speed and coolant while preserving source time and percentages", () => {
    const frame: TelemetryFrame = {
      timestamp: 12.5,
      speedKmh: 100,
      rpm: 2500,
      coolantTempC: 90,
      throttlePct: 30,
      engineLoadPct: 45,
    }

    const displayFrame = toDisplayUnits(frame, "imperial")

    expect(displayFrame.timestamp).toBe(frame.timestamp)
    expect(displayFrame.speed).toBeCloseTo(62.1371, 4)
    expect(displayFrame.speedUnit).toBe("mph")
    expect(displayFrame.coolantTemp).toBe(194)
    expect(displayFrame.coolantUnit).toBe("°F")
    expect(displayFrame.rpm).toBe(frame.rpm)
    expect(displayFrame.throttlePct).toBe(frame.throttlePct)
    expect(displayFrame.engineLoadPct).toBe(frame.engineLoadPct)
  })
})
