import type {
  TelemetryFrame,
  TelemetryListener,
  TelemetrySource,
  TelemetrySourceStatus,
} from "@/types/telemetry"

export type MockTelemetryMode = "normal" | "mountain"

const FRAME_PERIOD_MS = 100
const NORMAL_COOLANT_TIME_CONSTANT_SECONDS = 180
const MOUNTAIN_COOLANT_TIME_CONSTANT_SECONDS = 32
const MAX_SPEED_KMH = 160
const RPM_PER_KMH_BY_GEAR = [145, 95, 65, 48, 38]
const UPSHIFT_SPEED_KMH = [20, 38, 62, 90]
const DOWNSHIFT_SPEED_KMH = [14, 29, 50, 76]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export class MockTelemetrySource implements TelemetrySource {
  readonly kind = "mock" as const

  private listener: TelemetryListener | null = null
  private timer: number | null = null
  private mode: MockTelemetryMode
  private simulatedTimeSeconds = 0
  private speedKmh = 0
  private coolantTempC: number
  private gear = 1

  constructor(mode: MockTelemetryMode = "normal") {
    this.mode = mode
    this.coolantTempC = mode === "mountain" ? 88 : 20
  }

  subscribe(listener: TelemetryListener) {
    this.listener = listener
    this.emitFrame()

    if (this.timer === null) {
      this.timer = window.setInterval(() => this.emitFrame(), FRAME_PERIOD_MS)
    }
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.listener = null
  }

  setMode(mode: MockTelemetryMode) {
    if (mode === this.mode) {
      return
    }

    this.mode = mode
    this.simulatedTimeSeconds = 0
    this.speedKmh = 0
    this.gear = 1
    this.coolantTempC = mode === "mountain" ? 88 : 20
  }

  getMode() {
    return this.mode
  }

  private emitFrame() {
    const frame = this.simulateStep(0.1)
    this.listener?.(frame)
  }

  private simulateStep(seconds: number): TelemetryFrame {
    const elapsed = this.simulatedTimeSeconds
    const targetSpeedKmh =
      this.mode === "mountain"
        ? 42 + 4 * Math.sin(elapsed * 0.12)
        : elapsed < 8
          ? 55
          : 78 + 8 * Math.sin((elapsed - 8) * 0.18)
    const speedError = targetSpeedKmh - this.speedKmh
    const throttlePct =
      this.mode === "mountain"
        ? clamp(28 + speedError * 0.5, 20, 62)
        : clamp(14 + speedError * 0.55, 10, 55)
    const accelerationKmhPerSecond = clamp(
      (targetSpeedKmh - this.speedKmh) * 0.45 + (throttlePct - 12) * 0.04,
      -4,
      5
    )

    this.speedKmh = clamp(
      this.speedKmh + accelerationKmhPerSecond * seconds,
      0,
      MAX_SPEED_KMH
    )

    while (
      this.gear < RPM_PER_KMH_BY_GEAR.length &&
      this.speedKmh > UPSHIFT_SPEED_KMH[this.gear - 1]
    ) {
      this.gear += 1
    }
    while (
      this.gear > 1 &&
      this.speedKmh < DOWNSHIFT_SPEED_KMH[this.gear - 2]
    ) {
      this.gear -= 1
    }

    const signal = elapsed * 7
    const rpm = clamp(
      700 +
        this.speedKmh *
          RPM_PER_KMH_BY_GEAR[this.gear - 1] *
          (0.78 + throttlePct / 220) +
        Math.sin(signal) * 18,
      665,
      5800
    )

    const coolantTargetC = this.mode === "mountain" ? 105 : 90
    const timeConstant =
      this.mode === "mountain"
        ? MOUNTAIN_COOLANT_TIME_CONSTANT_SECONDS
        : NORMAL_COOLANT_TIME_CONSTANT_SECONDS
    const warmupFraction = 1 - Math.exp(-seconds / timeConstant)
    this.coolantTempC += (coolantTargetC - this.coolantTempC) * warmupFraction

    const engineLoadPct = clamp(
      12 +
        throttlePct * 0.72 +
        (this.speedKmh > 1 ? 8 : 0) +
        Math.cos(elapsed * 5) * 2,
      0,
      100
    )

    this.simulatedTimeSeconds += seconds

    return {
      timestamp: this.simulatedTimeSeconds,
      rpm,
      speedKmh: clamp(
        this.speedKmh + Math.cos(signal) * 0.15,
        0,
        MAX_SPEED_KMH
      ),
      coolantTempC: clamp(
        this.coolantTempC + Math.sin(elapsed * 5) * 0.2,
        0,
        110
      ),
      throttlePct,
      engineLoadPct,
    }
  }
}

type WebSocketTelemetryOptions = {
  reconnectDelayMs?: number
}

function isTelemetryFrame(value: unknown): value is TelemetryFrame {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const frame = value as Record<string, unknown>
  return (
    isFiniteNumber(frame.timestamp) &&
    isFiniteNumber(frame.speedKmh) &&
    isFiniteNumber(frame.rpm) &&
    isFiniteNumber(frame.coolantTempC) &&
    isFiniteNumber(frame.throttlePct) &&
    isFiniteNumber(frame.engineLoadPct)
  )
}

export class WebSocketTelemetrySource implements TelemetrySource {
  readonly kind = "websocket" as const

  private readonly reconnectDelayMs: number
  private readonly listeners = new Set<TelemetryListener>()
  private readonly statusListeners = new Set<
    (status: TelemetrySourceStatus) => void
  >()
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private stopped = false
  private readonly url: string

  constructor(url: string, options: WebSocketTelemetryOptions = {}) {
    this.url = url
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000
  }

  subscribe(listener: TelemetryListener) {
    this.listeners.add(listener)
    this.stopped = false
    this.connect()
  }

  subscribeStatus(listener: (status: TelemetrySourceStatus) => void) {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  stop() {
    this.stopped = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.listeners.clear()
  }

  private connect() {
    if (this.stopped || this.socket) {
      return
    }

    this.publishStatus("reconnecting")
    const socket = new WebSocket(this.url)
    this.socket = socket

    socket.addEventListener("open", () => this.publishStatus("connected"))
    socket.addEventListener("message", (event) => {
      try {
        const payload: unknown = JSON.parse(event.data)
        if (isTelemetryFrame(payload)) {
          this.listeners.forEach((listener) => listener(payload))
        }
      } catch {
        // Ignore malformed frames; a future backend error channel can report them.
      }
    })
    socket.addEventListener("close", () => {
      this.socket = null
      if (!this.stopped) {
        this.publishStatus("reconnecting")
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null
          this.connect()
        }, this.reconnectDelayMs)
      }
    })
    socket.addEventListener("error", () => {
      this.publishStatus("reconnecting")
    })
  }

  private publishStatus(status: TelemetrySourceStatus) {
    this.statusListeners.forEach((listener) => listener(status))
  }
}
