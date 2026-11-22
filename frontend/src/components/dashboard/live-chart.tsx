import { ChartLineIcon } from "@phosphor-icons/react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  COOLANT_HOT_THRESHOLD_FRAME,
  TELEMETRY_RANGE_MIN_FRAME,
  TELEMETRY_RANGE_FRAME,
  toDisplayUnits,
  type DisplayUnitSystem,
  type TelemetryFrame,
  type TelemetrySourceStatus,
} from "@/types/telemetry"

import { CHART_WINDOW_SECONDS } from "@/lib/telemetry-history"

import {
  CHART_TIME_MAX_SECONDS,
  CHART_TIME_MIN_SECONDS,
  CHART_TIME_TICKS_SECONDS,
  CHART_VALUE_TICK_COUNT,
} from "./dashboard-constants"
import { IconChip } from "./icon-chip"

type LiveChartProps = {
  history: TelemetryFrame[]
  units: DisplayUnitSystem
  status: TelemetrySourceStatus
}

const chartConfig = {
  speed: {
    label: "Speed",
    color: "var(--chart-1)",
  },
  coolant: {
    label: "Coolant",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

/** Renders the bounded telemetry history with display-unit chart labels. */
export function LiveChart({ history, units, status }: LiveChartProps) {
  const displayMinimum = toDisplayUnits(TELEMETRY_RANGE_MIN_FRAME, units)
  const displayRange = toDisplayUnits(TELEMETRY_RANGE_FRAME, units)
  const displayHotThreshold = toDisplayUnits(
    COOLANT_HOT_THRESHOLD_FRAME,
    units
  )
  const latestTimestamp = history[history.length - 1]?.timestamp ?? 0
  const speedTicks = Array.from(
    { length: CHART_VALUE_TICK_COUNT },
    (_, index) => {
      const fraction = index / (CHART_VALUE_TICK_COUNT - 1)
    return (
      displayMinimum.speed +
      (displayRange.speed - displayMinimum.speed) * fraction
    )
    }
  )
  const coolantTicks = Array.from(
    { length: CHART_VALUE_TICK_COUNT },
    (_, index) => {
      const fraction = index / (CHART_VALUE_TICK_COUNT - 1)
    return (
      displayMinimum.coolantTemp +
      (displayRange.coolantTemp - displayMinimum.coolantTemp) * fraction
    )
    }
  )
  const data = history.map((frame) => {
    const displayFrame = toDisplayUnits(frame, units)
    return {
      secondsAgo: Math.max(
        -CHART_WINDOW_SECONDS,
        displayFrame.timestamp - latestTimestamp
      ),
      speed: Number(displayFrame.speed.toFixed(1)),
      coolant: Number(displayFrame.coolantTemp.toFixed(1)),
    }
  })
  const latestPoint = data[data.length - 1]
  const hasHistory = data.length > 0
  const waitingLabel =
    status === "reconnecting"
      ? "Reconnecting to telemetry…"
      : "Waiting for telemetry…"

  return (
    <Card className="min-w-0" aria-labelledby="live-telemetry-title">
      <CardHeader className="gap-0.5">
        <div className="flex items-center gap-2">
          <IconChip>
            <ChartLineIcon />
          </IconChip>
          <CardTitle id="live-telemetry-title">Live telemetry</CardTitle>
        </div>
        <CardDescription className="pl-10 text-xs sm:text-sm">
          Last {CHART_WINDOW_SECONDS} seconds · Speed (
          {units === "metric" ? "km/h" : "mph"}) · Coolant (
          {units === "metric" ? "°C" : "°F"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`t-skel grid ${hasHistory ? "is-revealed" : ""}`}
          aria-busy={!hasHistory}
        >
          <div className="t-skel-skeleton is-pulsing flex h-64 items-center justify-center sm:h-72">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-end gap-2" aria-hidden="true">
                <span className="h-10 w-2 rounded-sm bg-muted" />
                <span className="h-16 w-2 rounded-sm bg-muted" />
                <span className="h-12 w-2 rounded-sm bg-muted" />
                <span className="h-20 w-2 rounded-sm bg-muted" />
              </div>
              <p className="text-sm text-muted-foreground">{waitingLabel}</p>
            </div>
          </div>
          <div className="t-skel-content min-w-0">
            <div
              className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm"
              aria-hidden="true"
            >
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-[3px] bg-chart-1" />
                Speed
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-[3px] bg-chart-2" />
                Coolant
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-[3px] bg-destructive" />
                Hot limit
              </span>
            </div>
            <ChartContainer
              config={chartConfig}
              className="h-64 w-full sm:h-72"
              role="img"
              aria-label={`Live telemetry chart for the last ${CHART_WINDOW_SECONDS} seconds`}
            >
              <AreaChart
                data={data}
                margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="secondsAgo"
                  type="number"
                  domain={[CHART_TIME_MIN_SECONDS, CHART_TIME_MAX_SECONDS]}
                  ticks={CHART_TIME_TICKS_SECONDS}
                  allowDataOverflow
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: number) =>
                    value === CHART_TIME_MAX_SECONDS ? "now" : `${value}s`
                  }
                />
                <YAxis
                  yAxisId="speed"
                  domain={[displayMinimum.speed, displayRange.speed]}
                  ticks={speedTicks}
                  allowDataOverflow
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  width={36}
                  tickFormatter={(value: number) =>
                    Math.round(value).toString()
                  }
                />
                <YAxis
                  yAxisId="coolant"
                  orientation="right"
                  domain={[
                    displayMinimum.coolantTemp,
                    displayRange.coolantTemp,
                  ]}
                  ticks={coolantTicks}
                  allowDataOverflow
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  width={36}
                  tickFormatter={(value: number) =>
                    Math.round(value).toString()
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        const secondsAgo = Number(value)
                        return secondsAgo === 0
                          ? "now"
                          : `${secondsAgo.toFixed(1)}s ago`
                      }}
                      formatter={(value, name) => (
                        <span className="flex min-w-28 justify-between gap-4">
                          <span>
                            {name === "speed"
                              ? `Speed (${units === "metric" ? "km/h" : "mph"})`
                              : `Coolant (${units === "metric" ? "°C" : "°F"})`}
                          </span>
                          <span className="font-mono tabular-nums">
                            {Number(value).toFixed(1)}{" "}
                            {name === "speed"
                              ? units === "metric"
                                ? "km/h"
                                : "mph"
                              : units === "metric"
                                ? "°C"
                                : "°F"}
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                <ReferenceLine
                  yAxisId="coolant"
                  y={displayHotThreshold.coolantTemp}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                />
                <Area
                  yAxisId="speed"
                  dataKey="speed"
                  type="monotone"
                  stroke="var(--color-speed)"
                  fill="var(--color-speed)"
                  fillOpacity={0.06}
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="coolant"
                  dataKey="coolant"
                  type="monotone"
                  stroke="var(--color-coolant)"
                  fill="var(--color-coolant)"
                  fillOpacity={0.06}
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
          <p className="sr-only">
            {hasHistory && latestPoint
              ? `Latest speed ${latestPoint.speed.toFixed(1)} ${
                  units === "metric" ? "kilometers per hour" : "miles per hour"
                }, coolant ${latestPoint.coolant.toFixed(1)} degrees ${
                  units === "metric" ? "Celsius" : "Fahrenheit"
                }.`
              : waitingLabel}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
