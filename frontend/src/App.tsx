import { useTelemetry } from "@/hooks/useTelemetry"

import { TelemetryDashboard } from "@/components/dashboard/telemetry-dashboard"

/** Connects the telemetry hook to the dashboard presentation. */
export function App() {
  const telemetry = useTelemetry()

  return (
    <TelemetryDashboard
      history={telemetry.history}
      metricFrame={telemetry.metricFrame}
      status={telemetry.status}
      isMockSource={telemetry.isMockSource}
      mockMode={telemetry.mockMode}
      onMockModeChange={telemetry.setMockMode}
    />
  )
}

/** Default application entry component for the Vite bootstrap. */
export default App
