import { WarningIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { MockTelemetryMode } from "@/lib/telemetry-source"
import {
  TELEMETRY_RANGE_MIN_FRAME,
  TELEMETRY_RANGE_FRAME,
  TELEMETRY_RANGES,
  toDisplayUnits,
  type DisplayUnitSystem,
  type TelemetryFrame,
  type TelemetrySourceStatus,
} from "@/types/telemetry"

import { GaugeCard, getCoolantZone } from "./gauge-card"
import { HeaderControls } from "./header-controls"
import { LiveChart } from "./live-chart"
import { MetricReadout } from "./metric-readout"

type TelemetryDashboardProps = {
  history: TelemetryFrame[]
  metricFrame: TelemetryFrame | null
  status: TelemetrySourceStatus
  isMockSource: boolean
  mockMode: MockTelemetryMode
  onMockModeChange: (mode: MockTelemetryMode) => void
}

const HOT_THRESHOLD_FRAME: TelemetryFrame = {
  ...TELEMETRY_RANGE_FRAME,
  coolantTempC: 102,
}

export function TelemetryDashboard({
  history,
  metricFrame,
  status,
  isMockSource,
  mockMode,
  onMockModeChange,
}: TelemetryDashboardProps) {
  const [units, setUnits] = useState<DisplayUnitSystem>("metric")
  const displayFrame = metricFrame ? toDisplayUnits(metricFrame, units) : null
  const displayGaugeMinimum = toDisplayUnits(TELEMETRY_RANGE_MIN_FRAME, units)
  const displayGaugeDomain = toDisplayUnits(TELEMETRY_RANGE_FRAME, units)
  const displayHotThreshold = toDisplayUnits(HOT_THRESHOLD_FRAME, units)
  const coolantZone = getCoolantZone(metricFrame?.coolantTempC ?? 0)
  const isHot = (metricFrame?.coolantTempC ?? 0) > 102

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Tacoma telemetry
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Vehicle dashboard
            </h1>
          </div>
          <HeaderControls
            units={units}
            onUnitsChange={setUnits}
            status={status}
            isMockSource={isMockSource}
            mockMode={mockMode}
            onMockModeChange={onMockModeChange}
          />
        </header>

        <Separator />

        {isHot ? (
          <div className="overflow-hidden">
            <div className="t-panel-slide" data-open="true">
              <Alert variant="destructive">
                <WarningIcon />
                <AlertTitle>Coolant temperature is hot</AlertTitle>
                <AlertDescription>
                  Coolant is at {displayFrame?.coolantTemp.toFixed(1)}
                  {displayFrame?.coolantUnit}; the hot threshold is{" "}
                  {displayHotThreshold.coolantTemp.toFixed(0)}
                  {displayHotThreshold.coolantUnit}. Reduce engine load and
                  check the cooling system.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        ) : null}

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="Primary telemetry"
        >
          <GaugeCard
            title="Engine speed"
            description="Current crankshaft speed"
            value={metricFrame?.rpm ?? 0}
            displayValue={
              metricFrame ? Math.round(metricFrame.rpm).toString() : "—"
            }
            unit="rpm"
            minValue={TELEMETRY_RANGES.rpm.min}
            maxValue={TELEMETRY_RANGES.rpm.max}
            color="var(--chart-3)"
          />
          <GaugeCard
            title="Road speed"
            description="Current vehicle speed"
            value={displayFrame?.speed ?? 0}
            displayValue={displayFrame ? displayFrame.speed.toFixed(1) : "—"}
            unit={displayFrame?.speedUnit ?? "km/h"}
            minValue={displayGaugeMinimum.speed}
            maxValue={displayGaugeDomain.speed}
            color="var(--chart-1)"
          />
          <GaugeCard
            title="Coolant temperature"
            description="Thermostat circuit temperature"
            value={displayFrame?.coolantTemp ?? 0}
            displayValue={
              displayFrame ? displayFrame.coolantTemp.toFixed(1) : "—"
            }
            unit={displayFrame?.coolantUnit ?? "°C"}
            minValue={displayGaugeMinimum.coolantTemp}
            maxValue={displayGaugeDomain.coolantTemp}
            color={
              coolantZone === "Hot"
                ? "var(--destructive)"
                : coolantZone === "Warm"
                  ? "var(--warning)"
                  : "var(--chart-2)"
            }
            zone={coolantZone}
          />
        </section>

        <LiveChart history={history} units={units} />

        <section
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Load metrics"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Throttle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricReadout
                value={
                  displayFrame ? `${displayFrame.throttlePct.toFixed(1)}%` : "—"
                }
                className="text-3xl tracking-tight"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Engine load
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricReadout
                value={
                  displayFrame
                    ? `${displayFrame.engineLoadPct.toFixed(1)}%`
                    : "—"
                }
                className="text-3xl tracking-tight"
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
