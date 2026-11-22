import type { TelemetryFrame } from "@/types/telemetry"

/** Maximum number of frames retained for the scrolling telemetry chart. */
export const MAX_HISTORY_FRAMES = 600

/** Duration of telemetry history shown by the chart, in seconds. */
export const CHART_WINDOW_SECONDS = 60

/**
 * Appends one frame while enforcing source ordering, the time window, and
 * the maximum sample count.
 *
 * A frame at or before the retained latest timestamp is ignored so chart
 * history cannot move backward when a transport delivers a stale frame.
 */
export function appendTelemetryFrame(
  history: TelemetryFrame[],
  frame: TelemetryFrame
): TelemetryFrame[] {
  const latestFrame = history[history.length - 1]
  if (latestFrame && frame.timestamp <= latestFrame.timestamp) {
    return history
  }

  const windowStartSeconds = frame.timestamp - CHART_WINDOW_SECONDS
  const windowedHistory = history.filter(
    (historyFrame) => historyFrame.timestamp >= windowStartSeconds
  )

  return [...windowedHistory, frame].slice(-MAX_HISTORY_FRAMES)
}
