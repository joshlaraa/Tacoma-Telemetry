import {
  CpuIcon,
  GaugeIcon,
  LightningIcon,
  SpeedometerIcon,
  ThermometerIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { MockTelemetryMode } from "@/lib/telemetry-source"
import {
  COOLANT_HOT_THRESHOLD_C,
  COOLANT_HOT_THRESHOLD_FRAME,
  TELEMETRY_RANGE_MIN_FRAME,
  TELEMETRY_RANGE_FRAME,
  TELEMETRY_RANGES,
  toDisplayUnits,
  type DisplayUnitSystem,
  type TelemetryFrame,
  type TelemetrySourceStatus,
} from "@/types/telemetry"

import { ALERT_CLOSE_FALLBACK_MS } from "./dashboard-constants"
import { GaugeCard, getCoolantZone } from "./gauge-card"
import { HeaderControls } from "./header-controls"
import { IconChip } from "./icon-chip"
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

function AnimatedAlert({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    let enterFrame = 0
    let timer = 0

    if (open) {
      frame = window.requestAnimationFrame(() => {
        setMounted(true)
        enterFrame = window.requestAnimationFrame(() => {
          setHeight(contentRef.current?.scrollHeight ?? 0)
          setShown(true)
        })
      })
    } else {
      frame = window.requestAnimationFrame(() => {
        setShown(false)
        setHeight(0)
        const styles = getComputedStyle(document.documentElement)
        const closeDuration =
          Number.parseFloat(styles.getPropertyValue("--panel-close-dur")) ||
          ALERT_CLOSE_FALLBACK_MS
        timer = window.setTimeout(() => setMounted(false), closeDuration)
      })
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(enterFrame)
      window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    const content = contentRef.current
    if (!content || !mounted || !open) {
      return
    }

    const observer = new ResizeObserver(() => {
      setHeight(content.scrollHeight)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [mounted, open])

  return (
    <div
      className="t-resize overflow-hidden"
      style={{ height: mounted ? height : 0 }}
      aria-hidden={!open}
    >
      {mounted ? (
        <div ref={contentRef} className="t-panel-slide pb-px" data-open={shown}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

function LoadMetricCard({
  icon,
  title,
  value,
  hasData,
}: {
  icon: ReactNode
  title: string
  value: string
  hasData: boolean
}) {
  return (
    <Card size="sm" aria-busy={!hasData}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconChip>{icon}</IconChip>
          <CardTitle className="leading-tight">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`t-skel grid ${hasData ? "is-revealed" : ""}`}>
          <div className="t-skel-skeleton is-pulsing">
            <div className="h-8 w-24 rounded-md bg-muted" />
          </div>
          <div className="t-skel-content">
            <MetricReadout
              value={value}
              className="text-3xl tracking-tight sm:text-4xl"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Composes the telemetry dashboard from hook-provided native frames. */
export function TelemetryDashboard({
  history,
  metricFrame,
  status,
  isMockSource,
  mockMode,
  onMockModeChange,
}: TelemetryDashboardProps) {
  const [units, setUnits] = useState<DisplayUnitSystem>("metric")
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const displayFrame = metricFrame ? toDisplayUnits(metricFrame, units) : null
  const displayGaugeMinimum = toDisplayUnits(TELEMETRY_RANGE_MIN_FRAME, units)
  const displayGaugeDomain = toDisplayUnits(TELEMETRY_RANGE_FRAME, units)
  const displayHotThreshold = toDisplayUnits(
    COOLANT_HOT_THRESHOLD_FRAME,
    units
  )
  const coolantZone = metricFrame
    ? getCoolantZone(metricFrame.coolantTempC)
    : undefined
  const isHot = (metricFrame?.coolantTempC ?? 0) > COOLANT_HOT_THRESHOLD_C

  return (
    <main className="min-h-svh bg-background">
      <div
        className={`t-stagger mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8 ${
          entered ? "is-shown" : ""
        }`}
      >
        <header className="t-stagger-line t-stagger-line--1 t-stagger-flex items-start justify-between gap-4 sm:items-center">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
              Telemetry Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              2011 Toyota Tacoma
            </p>
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

        <Separator className="t-stagger-line t-stagger-line--2" />

        <AnimatedAlert open={isHot}>
          <Alert variant="destructive">
            <WarningIcon />
            <AlertTitle>Coolant temperature is hot</AlertTitle>
            <AlertDescription>
              Coolant is at {displayFrame?.coolantTemp.toFixed(1)}
              {displayFrame?.coolantUnit}; the hot threshold is{" "}
              {displayHotThreshold.coolantTemp.toFixed(1)}
              {displayHotThreshold.coolantUnit}. Reduce engine load and check
              the cooling system.
            </AlertDescription>
          </Alert>
        </AnimatedAlert>

        <section
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
          aria-label="Primary telemetry"
        >
          <div className="t-stagger-line t-stagger-line--2 h-full">
            <GaugeCard
              icon={<GaugeIcon />}
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
              hasData={metricFrame !== null}
            />
          </div>
          <div className="t-stagger-line t-stagger-line--3 h-full">
            <GaugeCard
              icon={<SpeedometerIcon />}
              title="Road speed"
              description="Current vehicle speed"
              value={displayFrame?.speed ?? 0}
              displayValue={displayFrame ? displayFrame.speed.toFixed(1) : "—"}
              unit={displayFrame?.speedUnit ?? "km/h"}
              minValue={displayGaugeMinimum.speed}
              maxValue={displayGaugeDomain.speed}
              color="var(--chart-1)"
              hasData={metricFrame !== null}
            />
          </div>
          <div className="t-stagger-line t-stagger-line--4 col-span-2 h-full md:col-span-1">
            <GaugeCard
              icon={<ThermometerIcon />}
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
              hasData={metricFrame !== null}
              compactWide
            />
          </div>
        </section>

        <div className="t-stagger-line t-stagger-line--4">
          <LiveChart history={history} units={units} status={status} />
        </div>

        <section
          className="t-stagger-line t-stagger-line--5 t-stagger-grid grid-cols-2 gap-3 sm:gap-4"
          aria-label="Load metrics"
        >
          <LoadMetricCard
            icon={<LightningIcon />}
            title="Throttle"
            value={
              displayFrame ? `${displayFrame.throttlePct.toFixed(1)}%` : "—"
            }
            hasData={displayFrame !== null}
          />
          <LoadMetricCard
            icon={<CpuIcon />}
            title="Engine load"
            value={
              displayFrame ? `${displayFrame.engineLoadPct.toFixed(1)}%` : "—"
            }
            hasData={displayFrame !== null}
          />
        </section>
      </div>
    </main>
  )
}
