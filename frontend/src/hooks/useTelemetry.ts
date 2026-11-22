import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  MockTelemetrySource,
  type MockTelemetryMode,
} from "@/lib/telemetry-source"
import type {
  TelemetryFrame,
  TelemetrySource,
  TelemetrySourceStatus,
} from "@/types/telemetry"

const MAX_HISTORY_LENGTH = 600
const DISPLAY_FRAME_INTERVAL = 5

export function useTelemetry() {
  // Switch this one line to WebSocketTelemetrySource when the backend transport exists.
  const source = useMemo<TelemetrySource>(() => new MockTelemetrySource(), [])
  const [history, setHistory] = useState<TelemetryFrame[]>([])
  const [metricFrame, setMetricFrame] = useState<TelemetryFrame | null>(null)
  const [status, setStatus] = useState<TelemetrySourceStatus>(
    source.kind === "mock" ? "mock" : "reconnecting"
  )
  const [mockMode, setMockModeState] = useState<MockTelemetryMode>("normal")
  const frameCount = useRef(0)

  useEffect(() => {
    frameCount.current = 0
    const unsubscribeStatus = source.subscribeStatus?.(setStatus)

    source.subscribe((frame) => {
      frameCount.current += 1
      setHistory((currentHistory) => [
        ...currentHistory.slice(-(MAX_HISTORY_LENGTH - 1)),
        frame,
      ])

      if (
        frameCount.current === 1 ||
        frameCount.current % DISPLAY_FRAME_INTERVAL === 0
      ) {
        setMetricFrame(frame)
      }
    })

    return () => {
      unsubscribeStatus?.()
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
        // The mock clock restarts per scenario, so discard the prior epoch;
        // every retained history timestamp then increases by 0.1 seconds.
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
