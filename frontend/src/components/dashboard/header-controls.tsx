import { useEffect, useRef } from "react"
import {
  ArrowsClockwiseIcon,
  MoonIcon,
  SunIcon,
  WifiHighIcon,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme } from "@/components/theme-provider"
import type { MockTelemetryMode } from "@/lib/telemetry-source"
import type {
  DisplayUnitSystem,
  TelemetrySourceStatus,
} from "@/types/telemetry"

import { SoftText } from "./soft-text"

type HeaderControlsProps = {
  units: DisplayUnitSystem
  onUnitsChange: (units: DisplayUnitSystem) => void
  status: TelemetrySourceStatus
  isMockSource: boolean
  mockMode: MockTelemetryMode
  onMockModeChange: (mode: MockTelemetryMode) => void
}

function statusLabel(status: TelemetrySourceStatus) {
  if (status === "mock") {
    return "Mock mode"
  }
  if (status === "connected") {
    return "Connected"
  }
  return "Reconnecting"
}

function statusVariant(status: TelemetrySourceStatus) {
  if (status === "reconnecting") {
    return "destructive" as const
  }
  return "secondary" as const
}

export function HeaderControls({
  units,
  onUnitsChange,
  status,
  isMockSource,
  mockMode,
  onMockModeChange,
}: HeaderControlsProps) {
  const { theme, setTheme } = useTheme()
  const tabsRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const initializedTabs = useRef(false)
  const isDark = document.documentElement.classList.contains("dark")

  useEffect(() => {
    const bar = tabsRef.current
    const pill = pillRef.current
    if (!bar || !pill) {
      return
    }

    const movePill = (animate: boolean) => {
      const active = bar.querySelector<HTMLElement>(`[data-value="${units}"]`)
      if (!active) {
        return
      }

      if (!animate) {
        const previousTransition = pill.style.transition
        pill.style.transition = "none"
        pill.style.transform = `translateX(${active.offsetLeft}px)`
        pill.style.width = `${active.offsetWidth}px`
        void pill.offsetWidth
        pill.style.transition = previousTransition
        return
      }

      pill.style.transform = `translateX(${active.offsetLeft}px)`
      pill.style.width = `${active.offsetWidth}px`
    }

    const frame = window.requestAnimationFrame(() => {
      movePill(initializedTabs.current)
      initializedTabs.current = true
    })
    const handleResize = () => movePill(false)
    window.addEventListener("resize", handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", handleResize)
    }
  }, [units])

  const resolvedDark = theme === "dark" || (theme === "system" && isDark)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant={statusVariant(status)} className="gap-1.5">
        {status === "reconnecting" ? (
          <ArrowsClockwiseIcon className="size-3.5" />
        ) : (
          <WifiHighIcon className="size-3.5" />
        )}
        <SoftText value={statusLabel(status)} />
      </Badge>

      {isMockSource ? (
        <Select
          value={mockMode}
          onValueChange={(value) =>
            onMockModeChange(value as MockTelemetryMode)
          }
        >
          <SelectTrigger aria-label="Simulation mode" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal drive</SelectItem>
            <SelectItem value="mountain">Mountain climb</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <div ref={tabsRef} className="t-tabs" role="tablist" aria-label="Units">
        <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
        <ToggleGroup
          type="single"
          value={units}
          onValueChange={(value) => {
            if (value === "metric" || value === "imperial") {
              onUnitsChange(value)
            }
          }}
          variant="default"
          size="sm"
          spacing={0}
          className="relative z-10"
          aria-label="Units"
        >
          <ToggleGroupItem
            value="metric"
            className="t-tab"
            aria-selected={units === "metric"}
          >
            Metric
          </ToggleGroupItem>
          <ToggleGroupItem
            value="imperial"
            className="t-tab"
            aria-selected={units === "imperial"}
          >
            Imperial
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label={resolvedDark ? "Use light theme" : "Use dark theme"}
        onClick={() => setTheme(resolvedDark ? "light" : "dark")}
      >
        <span
          className="t-icon-swap"
          data-state={resolvedDark ? "b" : "a"}
          aria-hidden="true"
        >
          <span className="t-icon" data-icon="a">
            <SunIcon />
          </span>
          <span className="t-icon" data-icon="b">
            <MoonIcon />
          </span>
        </span>
      </Button>
    </div>
  )
}
