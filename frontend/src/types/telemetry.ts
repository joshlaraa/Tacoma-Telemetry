export type TelemetryFrame = Readonly<{
  timestamp: number
  speedKmh: number
  rpm: number
  coolantTempC: number
  throttlePct: number
  engineLoadPct: number
}>

export const TELEMETRY_RANGES = {
  rpm: { min: 0, max: 6000 },
  speedKmh: { min: 0, max: 180 },
  coolantTempC: { min: 0, max: 120 },
} as const

export const TELEMETRY_RANGE_MIN_FRAME: TelemetryFrame = {
  timestamp: 0,
  speedKmh: TELEMETRY_RANGES.speedKmh.min,
  rpm: TELEMETRY_RANGES.rpm.min,
  coolantTempC: TELEMETRY_RANGES.coolantTempC.min,
  throttlePct: 0,
  engineLoadPct: 0,
}

export const TELEMETRY_RANGE_FRAME: TelemetryFrame = {
  timestamp: 0,
  speedKmh: TELEMETRY_RANGES.speedKmh.max,
  rpm: TELEMETRY_RANGES.rpm.max,
  coolantTempC: TELEMETRY_RANGES.coolantTempC.max,
  throttlePct: 0,
  engineLoadPct: 0,
}

export type TelemetryListener = (frame: TelemetryFrame) => void

export type TelemetrySourceStatus = "mock" | "connected" | "reconnecting"

export type DisplayUnitSystem = "metric" | "imperial"

export type DisplayTelemetryFrame = Readonly<{
  timestamp: number
  speed: number
  speedUnit: "km/h" | "mph"
  coolantTemp: number
  coolantUnit: "°C" | "°F"
  rpm: number
  throttlePct: number
  engineLoadPct: number
}>

export interface TelemetrySource {
  readonly kind: "mock" | "websocket"
  subscribe(listener: TelemetryListener): void
  stop(): void
  subscribeStatus?(
    listener: (status: TelemetrySourceStatus) => void
  ): () => void
}

export function toDisplayUnits(
  frame: TelemetryFrame,
  units: DisplayUnitSystem
): DisplayTelemetryFrame {
  if (units === "metric") {
    return {
      timestamp: frame.timestamp,
      speed: frame.speedKmh,
      speedUnit: "km/h",
      coolantTemp: frame.coolantTempC,
      coolantUnit: "°C",
      rpm: frame.rpm,
      throttlePct: frame.throttlePct,
      engineLoadPct: frame.engineLoadPct,
    }
  }

  return {
    timestamp: frame.timestamp,
    speed: frame.speedKmh * 0.621371,
    speedUnit: "mph",
    coolantTemp: (frame.coolantTempC * 9) / 5 + 32,
    coolantUnit: "°F",
    rpm: frame.rpm,
    throttlePct: frame.throttlePct,
    engineLoadPct: frame.engineLoadPct,
  }
}
