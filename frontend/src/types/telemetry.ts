/**
 * One telemetry sample in OBD-native units.
 *
 * `timestamp` is source time in seconds and must increase monotonically within
 * a source stream. Display conversion belongs at the UI boundary.
 */
export type TelemetryFrame = Readonly<{
  /** Source time in seconds; strictly increasing within one stream. */
  timestamp: number
  /** Vehicle speed in kilometres per hour. */
  speedKmh: number
  /** Engine speed in revolutions per minute. */
  rpm: number
  /** Coolant temperature in degrees Celsius. */
  coolantTempC: number
  /** Throttle position as a percentage from 0 to 100. */
  throttlePct: number
  /** Calculated engine load as a percentage from 0 to 100. */
  engineLoadPct: number
}>

/** Minimum engine speed gauge domain, in revolutions per minute. */
export const RPM_GAUGE_MIN_RPM = 0

/** Maximum engine speed gauge domain, in revolutions per minute. */
export const RPM_GAUGE_MAX_RPM = 6000

/** Minimum road speed gauge domain, in kilometres per hour. */
export const SPEED_GAUGE_MIN_KMH = 0

/** Maximum road speed gauge domain, in kilometres per hour. */
export const SPEED_GAUGE_MAX_KMH = 180

/** Minimum coolant temperature gauge domain, in degrees Celsius. */
export const COOLANT_GAUGE_MIN_C = 0

/** Maximum coolant temperature gauge domain, in degrees Celsius. */
export const COOLANT_GAUGE_MAX_C = 120

/** Display domains for the primary telemetry gauges in native units. */
export const TELEMETRY_RANGES = {
  rpm: { min: RPM_GAUGE_MIN_RPM, max: RPM_GAUGE_MAX_RPM },
  speedKmh: { min: SPEED_GAUGE_MIN_KMH, max: SPEED_GAUGE_MAX_KMH },
  coolantTempC: { min: COOLANT_GAUGE_MIN_C, max: COOLANT_GAUGE_MAX_C },
} as const

/** Coolant temperature at which the dashboard changes to its warm state. */
export const COOLANT_WARM_THRESHOLD_C = 95

/** Coolant temperature above which the dashboard raises a hot alert. */
export const COOLANT_HOT_THRESHOLD_C = 102

/** A frame containing the minimum values of the primary gauge domains. */
export const TELEMETRY_RANGE_MIN_FRAME: TelemetryFrame = {
  timestamp: 0,
  speedKmh: TELEMETRY_RANGES.speedKmh.min,
  rpm: TELEMETRY_RANGES.rpm.min,
  coolantTempC: TELEMETRY_RANGES.coolantTempC.min,
  throttlePct: 0,
  engineLoadPct: 0,
}

/** A frame containing the maximum values of the primary gauge domains. */
export const TELEMETRY_RANGE_FRAME: TelemetryFrame = {
  timestamp: 0,
  speedKmh: TELEMETRY_RANGES.speedKmh.max,
  rpm: TELEMETRY_RANGES.rpm.max,
  coolantTempC: TELEMETRY_RANGES.coolantTempC.max,
  throttlePct: 0,
  engineLoadPct: 0,
}

/** A frame used to position the coolant hot threshold in display units. */
export const COOLANT_HOT_THRESHOLD_FRAME: TelemetryFrame = {
  ...TELEMETRY_RANGE_FRAME,
  coolantTempC: COOLANT_HOT_THRESHOLD_C,
}

/** Receives one accepted telemetry frame from a source. */
export type TelemetryListener = (frame: TelemetryFrame) => void

/** Connection state exposed by a telemetry source. */
export type TelemetrySourceStatus = "mock" | "connected" | "reconnecting"

/** Units used at the display boundary. */
export type DisplayUnitSystem = "metric" | "imperial"

/** A telemetry frame converted into the selected display units. */
export type DisplayTelemetryFrame = Readonly<{
  /** Source time in seconds; unchanged from the native frame. */
  timestamp: number
  /** Display speed, either kilometres per hour or miles per hour. */
  speed: number
  speedUnit: "km/h" | "mph"
  /** Display coolant temperature, either Celsius or Fahrenheit. */
  coolantTemp: number
  coolantUnit: "°C" | "°F"
  /** Engine speed in revolutions per minute. */
  rpm: number
  /** Throttle position as a percentage from 0 to 100. */
  throttlePct: number
  /** Calculated engine load as a percentage from 0 to 100. */
  engineLoadPct: number
}>

/**
 * Produces native telemetry frames and owns the source lifecycle.
 *
 * `subscribe` returns a function that removes only that listener. `stop`
 * terminates the source and releases all source-owned resources.
 */
export interface TelemetrySource {
  readonly kind: "mock" | "websocket"
  subscribe(listener: TelemetryListener): () => void
  stop(): void
  subscribeStatus?(
    listener: (status: TelemetrySourceStatus) => void
  ): () => void
}

const KILOMETRES_TO_MILES = 0.621371
const CELSIUS_TO_FAHRENHEIT_SCALE = 9 / 5
const FAHRENHEIT_OFFSET_F = 32

/**
 * Converts OBD-native telemetry into UI display units.
 *
 * The returned speed and coolant values are converted only when imperial
 * display is selected; RPM and percentage values remain unchanged.
 */
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
    speed: frame.speedKmh * KILOMETRES_TO_MILES,
    speedUnit: "mph",
    coolantTemp:
      frame.coolantTempC * CELSIUS_TO_FAHRENHEIT_SCALE +
      FAHRENHEIT_OFFSET_F,
    coolantUnit: "°F",
    rpm: frame.rpm,
    throttlePct: frame.throttlePct,
    engineLoadPct: frame.engineLoadPct,
  }
}
