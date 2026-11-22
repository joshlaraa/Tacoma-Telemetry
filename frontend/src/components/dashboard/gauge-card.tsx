import type { CSSProperties } from "react"
import { Pie, PieChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { MetricReadout } from "./metric-readout"
import { SoftText } from "./soft-text"

export type CoolantZone = "Normal" | "Warm" | "Hot"

type GaugeCardProps = {
  title: string
  description: string
  value: number
  displayValue: string
  unit: string
  minValue: number
  maxValue: number
  color: string
  zone?: CoolantZone
}

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--gauge-color)",
  },
} satisfies ChartConfig

export function getCoolantZone(coolantTempC: number): CoolantZone {
  if (coolantTempC > 102) {
    return "Hot"
  }
  if (coolantTempC >= 95) {
    return "Warm"
  }
  return "Normal"
}

export function GaugeCard({
  title,
  description,
  value,
  displayValue,
  unit,
  minValue,
  maxValue,
  color,
  zone,
}: GaugeCardProps) {
  const percentage = Math.min(
    100,
    Math.max(0, ((value - minValue) / (maxValue - minValue)) * 100)
  )
  const trackData = [
    { name: "track", value: 100, fill: "var(--gauge-track)" },
  ]
  const valueData = [
    { name: "value", value: percentage, fill: "var(--color-value)" },
    { name: "remaining", value: 100 - percentage, fill: "transparent" },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="relative mx-auto aspect-square w-full max-w-40 sm:max-w-56"
          style={{ "--gauge-color": color } as CSSProperties}
        >
          <ChartContainer
            config={chartConfig}
            className="h-full w-full"
          >
            <PieChart>
              <Pie
                data={trackData}
                dataKey="value"
                startAngle={225}
                endAngle={-45}
                innerRadius="72%"
                outerRadius="100%"
                stroke="none"
                isAnimationActive={false}
              />
              <Pie
                data={valueData}
                dataKey="value"
                startAngle={225}
                endAngle={-45}
                innerRadius="72%"
                outerRadius="100%"
                stroke="none"
                isAnimationActive={false}
              />
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <MetricReadout
              value={displayValue}
              className="text-3xl tracking-tight sm:text-4xl"
            />
            <SoftText value={unit} className="text-sm text-muted-foreground" />
            {zone ? (
              <span className="mt-3 text-xs font-semibold tracking-[0.18em] text-foreground uppercase">
                {zone}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
