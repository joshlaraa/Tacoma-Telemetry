import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  createTelemetrySource,
  MockTelemetrySource,
  type MockTelemetryMode,
} from "@/lib/telemetry-source"
import { appendTelemetryFrame } from "@/lib/telemetry-history"
import type {
  TelemetryFrame,
  TelemetrySource,
  TelemetrySourceStatus,
} from "@/types/telemetry"

// The mock emits at 10 Hz; every fifth frame keeps readouts at 2 Hz.
const DISPLAY_FRAME_INTERVAL_FRAMES = 5

/**
 * Bridges one telemetry source to React state.
 *
 * History updates at the source cadence while the current metric frame is
 * exposed every fifth accepted frame for the dashboard's lower-frequency
 * readouts.
 */
export function useTelemetry() {
  const source = useMemo<TelemetrySource>(
    () => createTelemetrySource({ kind: "mock" }),
    []
  )
  const [history, setHistory] = useState<TelemetryFrame[]>([])
  const [metricFrame, setMetricFrame] = useState<TelemetryFrame | null>(null)
  const [status, setStatus] = useState<TelemetrySourceStatus>(
    source.kind === "mock" ? "mock" : "reconnecting"
  )
  const [mockMode, setMockModeState] = useState<MockTelemetryMode>("normal")
  const frameCount = useRef(0)
  const latestTimestampSeconds = useRef<number | null>(null)

  useEffect(() => {
    frameCount.current = 0
    latestTimestampSeconds.current = null
    const unsubscribeStatus = source.subscribeStatus?.(setStatus)

    const unsubscribe = source.subscribe((frame) => {
      if (
        latestTimestampSeconds.current !== null &&
        frame.timestamp <= latestTimestampSeconds.current
      ) {
        return
      }

      latestTimestampSeconds.current = frame.timestamp
      frameCount.current += 1
      setHistory((currentHistory) =>
        appendTelemetryFrame(currentHistory, frame)
      )

      if (
        frameCount.current === 1 ||
        frameCount.current % DISPLAY_FRAME_INTERVAL_FRAMES === 0
      ) {
        setMetricFrame(frame)
      }
    })

    return () => {
      unsubscribeStatus?.()
      unsubscribe()
      source.stop()
    }
  }, [source])

  const setMockMode = useCallback(
    (nextMode: MockTelemetryMode) => {
      if (source instanceof MockTelemetrySource) {
        if (source.getMode() === nextMode) {
          return
        }

        source.setMode(nextMode)
        frameCount.current = 0
        setHistory([])
        setMetricFrame(null)
        setMockModeState(nextMode)
      }
    },
    [source]
  )

  return {
    history,
    metricFrame,
    status,
    isMockSource: source.kind === "mock",
    mockMode,
    setMockMode,
  }
}
