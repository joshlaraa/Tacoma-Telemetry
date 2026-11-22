import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
  toDisplayUnits,
  type DisplayUnitSystem,
  type TelemetryFrame,
} from "@/types/telemetry"

type LiveChartProps = {
  history: TelemetryFrame[]
  units: DisplayUnitSystem
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

export function LiveChart({ history, units }: LiveChartProps) {
  const data = history.map((frame) => {
    const displayFrame = toDisplayUnits(frame, units)
    return {
      timestamp: displayFrame.timestamp,
      speed: Number(displayFrame.speed.toFixed(1)),
      coolant: Number(displayFrame.coolantTemp.toFixed(1)),
    }
  })

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Live telemetry</CardTitle>
        <CardDescription>
          Last 60 seconds · Speed ({units === "metric" ? "km/h" : "mph"}) ·
          Coolant ({units === "metric" ? "°C" : "°F"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <AreaChart
            data={data}
            margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: number) => `${Math.round(value)}s`}
            />
            <YAxis
              yAxisId="speed"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              label={{
                value: `Speed (${units === "metric" ? "km/h" : "mph"})`,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                },
              }}
            />
            <YAxis
              yAxisId="coolant"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              label={{
                value: `Coolant (${units === "metric" ? "°C" : "°F"})`,
                angle: 90,
                position: "insideRight",
                style: {
                  textAnchor: "middle",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                },
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `${Number(value).toFixed(1)}s`}
                  formatter={(value, name) => (
                    <span className="flex min-w-28 justify-between gap-4">
                      <span>
                        {name === "speed"
                          ? `Speed (${units === "metric" ? "km/h" : "mph"})`
                          : `Coolant (${units === "metric" ? "°C" : "°F"})`}
                      </span>
                      <span className="font-mono tabular-nums">
                        {Number(value).toFixed(1)}
                      </span>
                    </span>
                  )}
                />
              }
            />
            <Area
              yAxisId="speed"
              dataKey="speed"
              type="monotone"
              stroke="var(--color-speed)"
              fill="var(--color-speed)"
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              yAxisId="coolant"
              dataKey="coolant"
              type="monotone"
              stroke="var(--color-coolant)"
              fill="var(--color-coolant)"
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-(--color-speed)" />
            Speed ({units === "metric" ? "km/h" : "mph"})
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-(--color-coolant)" />
            Coolant ({units === "metric" ? "°C" : "°F"})
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
