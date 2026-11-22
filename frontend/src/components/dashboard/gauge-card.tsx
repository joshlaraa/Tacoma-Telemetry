import { useId } from "react"
import type { CSSProperties, ReactNode } from "react"
import { Pie, PieChart } from "recharts"

import { cn } from "@/lib/utils"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  COOLANT_HOT_THRESHOLD_C,
  COOLANT_WARM_THRESHOLD_C,
} from "@/types/telemetry"

import {
  GAUGE_END_ANGLE_DEGREES,
  GAUGE_INNER_RADIUS_PERCENT,
  GAUGE_OUTER_RADIUS_PERCENT,
  GAUGE_PERCENT_MAX_PERCENT,
  GAUGE_PERCENT_MIN_PERCENT,
  GAUGE_START_ANGLE_DEGREES,
} from "./dashboard-constants"
import { IconChip } from "./icon-chip"
import { MetricReadout } from "./metric-readout"
import { SoftText } from "./soft-text"

type GaugeStyle = CSSProperties & {
  "--gauge-color": string
}

/** Human-readable coolant zone derived from a native Celsius value. */
export type CoolantZone = "Normal" | "Warm" | "Hot"

type GaugeCardProps = {
  icon: ReactNode
  title: string
  description: string
  value: number
  displayValue: string
  unit: string
  minValue: number
  maxValue: number
  color: string
  zone?: CoolantZone
  hasData: boolean
  compactWide?: boolean
}

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--gauge-color)",
  },
} satisfies ChartConfig

/** Classifies coolant temperature using native degrees Celsius thresholds. */
export function getCoolantZone(coolantTempC: number): CoolantZone {
  if (coolantTempC > COOLANT_HOT_THRESHOLD_C) {
    return "Hot"
  }
  if (coolantTempC >= COOLANT_WARM_THRESHOLD_C) {
    return "Warm"
  }
  return "Normal"
}

/** Displays one labelled telemetry gauge with an accessible current value. */
export function GaugeCard({
  icon,
  title,
  description,
  value,
  displayValue,
  unit,
  minValue,
  maxValue,
  color,
  zone,
  hasData,
  compactWide = false,
}: GaugeCardProps) {
  const titleId = useId()
  const gaugeStyle: GaugeStyle = { "--gauge-color": color }
  const percentage = Math.min(
    GAUGE_PERCENT_MAX_PERCENT,
    Math.max(
      GAUGE_PERCENT_MIN_PERCENT,
      ((value - minValue) / (maxValue - minValue)) *
        GAUGE_PERCENT_MAX_PERCENT
    )
  )
  const trackData = [
    {
      name: "track",
      value: GAUGE_PERCENT_MAX_PERCENT,
      fill: "var(--gauge-track)",
    },
  ]
  const valueData = [
    { name: "value", value: percentage, fill: "var(--color-value)" },
    {
      name: "remaining",
      value: GAUGE_PERCENT_MAX_PERCENT - percentage,
      fill: "transparent",
    },
  ]

  return (
    <Card
      size="sm"
      role="group"
      aria-labelledby={titleId}
      className={cn(
        "h-full min-w-0",
        compactWide &&
          "max-md:grid max-md:grid-cols-[minmax(0,1fr)_9rem] max-md:items-center max-md:gap-0"
      )}
      aria-busy={!hasData}
    >
      <CardHeader
        className={cn(compactWide && "max-md:self-center max-md:px-4")}
      >
        <div className="flex items-start gap-2">
          <IconChip>{icon}</IconChip>
          <div className="min-w-0 flex-1">
            <CardTitle id={titleId} className="leading-8">
              {title}
            </CardTitle>
            <CardDescription className="-mt-1 text-xs max-lg:hidden">
              {description}
            </CardDescription>
            {zone ? (
              <p className="text-xs font-medium text-muted-foreground md:hidden">
                {zone}
              </p>
            ) : null}
          </div>
          {zone ? (
            <span
              className="text-xs leading-8 font-medium max-md:hidden"
              style={{ color }}
            >
              <SoftText value={zone} />
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn("flex flex-1 items-center", compactWide && "max-md:pl-0")}
      >
        <div
          className={cn(
            "t-skel @container relative mx-auto grid aspect-square w-full max-w-28 sm:max-w-40 md:max-w-48",

            hasData && "is-revealed"
          )}
          style={gaugeStyle}
        >
          <div className="t-skel-skeleton is-pulsing flex items-center justify-center">
            <div className="flex size-[76%] flex-col items-center justify-center gap-2 rounded-full border-[10px] border-muted">
              <span className="h-3 w-12 rounded bg-muted" />
              <span className="h-2 w-8 rounded bg-muted" />
            </div>
          </div>
          <div className="t-skel-content relative h-full w-full">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full"
              style={{ aspectRatio: "auto", minWidth: 0 }}
              aria-hidden="true"
            >
              <PieChart>
                <Pie
                  data={trackData}
                  dataKey="value"
                  startAngle={GAUGE_START_ANGLE_DEGREES}
                  endAngle={GAUGE_END_ANGLE_DEGREES}
                  innerRadius={`${GAUGE_INNER_RADIUS_PERCENT}%`}
                  outerRadius={`${GAUGE_OUTER_RADIUS_PERCENT}%`}
                  stroke="none"
                  isAnimationActive={false}
                />
                <Pie
                  data={valueData}
                  dataKey="value"
                  startAngle={GAUGE_START_ANGLE_DEGREES}
                  endAngle={GAUGE_END_ANGLE_DEGREES}
                  innerRadius={`${GAUGE_INNER_RADIUS_PERCENT}%`}
                  outerRadius={`${GAUGE_OUTER_RADIUS_PERCENT}%`}
                  stroke="none"
                  isAnimationActive={false}
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <MetricReadout
                value={displayValue}
                className={cn(
                  "tracking-tight",
                  // sized from the ring width so digits always fit inside it
                  displayValue.length > 4 ? "text-[19cqw]" : "text-[24cqw]"
                )}
              />
              <SoftText
                value={unit}
                className="text-xs text-muted-foreground sm:text-sm"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
