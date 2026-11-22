import { useTelemetry } from "@/hooks/useTelemetry"

import { TelemetryDashboard } from "@/components/dashboard/telemetry-dashboard"

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

export default App
