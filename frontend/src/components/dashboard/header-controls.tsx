import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowsLeftRightIcon,
  MountainsIcon,
  MoonIcon,
  PlugsConnectedIcon,
  RulerIcon,
  SlidersHorizontalIcon,
  SunIcon,
} from "@phosphor-icons/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

function StatusIndicator({
  status,
  className,
}: {
  status: TelemetrySourceStatus
  className?: string
}) {
  const dotClass =
    status === "reconnecting"
      ? "bg-destructive"
      : status === "connected"
        ? "bg-chart-2"
        : "bg-chart-1"

  return (
    <span className={`whitespace-nowrap ${className ?? ""}`}>
      <span
        className={`size-1.5 shrink-0 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <SoftText value={statusLabel(status)} />
    </span>
  )
}

function useResolvedDark(theme: "dark" | "light" | "system") {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => {
      setIsDark(theme === "dark" || (theme === "system" && media.matches))
    }

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [theme])

  return isDark
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
  return (
    <span
      className="t-icon-swap"
      data-state={isDark ? "b" : "a"}
      aria-hidden="true"
    >
      <span className="t-icon" data-icon="a">
        <SunIcon />
      </span>
      <span className="t-icon" data-icon="b">
        <MoonIcon />
      </span>
    </span>
  )
}

function SettingIcon({
  children,
  small = false,
}: {
  children: ReactNode
  small?: boolean
}) {
  return (
    <span
      className={`${small ? "size-8" : "size-9"} flex shrink-0 items-center justify-center rounded-full bg-background text-foreground [&_svg]:size-4`}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

const tileClass =
  "t-control flex w-full items-center gap-3 rounded-xl bg-muted p-2.5 text-left"

function SettingTile({
  icon,
  title,
  value,
  actionLabel,
  onClick,
  trailing,
}: {
  icon: ReactNode
  title: string
  value: ReactNode
  actionLabel?: string
  onClick?: () => void
  trailing?: ReactNode
}) {
  const content = (
    <>
      <SettingIcon>{icon}</SettingIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-tight font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {value}
        </span>
      </span>
      {trailing}
    </>
  )

  if (!onClick) {
    return <div className={tileClass}>{content}</div>
  }

  return (
    <button
      type="button"
      className={`${tileClass} cursor-pointer border border-border bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-accent`}
      aria-label={actionLabel}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

function SettingsMenu({
  units,
  onUnitsChange,
  status,
  isMockSource,
  mockMode,
  onMockModeChange,
  isDark,
  onThemeToggle,
}: HeaderControlsProps & {
  isDark: boolean
  onThemeToggle: () => void
}) {
  const swap = (
    <ArrowsLeftRightIcon
      className="mr-1 size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  )
  const nextUnits = units === "metric" ? "imperial" : "metric"
  const nextMode = mockMode === "normal" ? "mountain" : "normal"

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="t-control flex min-w-0 cursor-pointer items-center gap-2 whitespace-nowrap bg-muted py-1 pr-3 pl-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Open dashboard settings"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background [&_svg]:size-4"
              aria-hidden="true"
            >
              <SlidersHorizontalIcon />
            </span>
            <StatusIndicator
              status={status}
              className="flex items-center gap-2"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))] space-y-2 p-3">
          <div className="flex items-center gap-3 px-0.5 pb-1">
            <SettingIcon>
              <SlidersHorizontalIcon />
            </SettingIcon>
            <span className="text-sm font-semibold">Settings</span>
          </div>
          <SettingTile
            icon={<PlugsConnectedIcon />}
            title="Connection"
            value={
              <StatusIndicator
                status={status}
                className="flex items-center gap-1.5"
              />
            }
          />
          {isMockSource ? (
            <SettingTile
              icon={<MountainsIcon />}
              title="Scenario"
              value={
                <SoftText
                  value={
                    mockMode === "normal" ? "Normal drive" : "Mountain climb"
                  }
                />
              }
              actionLabel={`Switch scenario to ${nextMode === "normal" ? "normal drive" : "mountain climb"}`}
              onClick={() => onMockModeChange(nextMode)}
              trailing={swap}
            />
          ) : null}
          <SettingTile
            icon={<RulerIcon />}
            title="Units"
            value={
              <SoftText
                value={
                  units === "metric"
                    ? "Metric (km/h, °C)"
                    : "Imperial (mph, °F)"
                }
              />
            }
            actionLabel={`Switch units to ${nextUnits}`}
            onClick={() => onUnitsChange(nextUnits)}
            trailing={swap}
          />
          <SettingTile
            icon={<ThemeIcon isDark={isDark} />}
            title="Appearance"
            value={<SoftText value={isDark ? "Dark theme" : "Light theme"} />}
            actionLabel={isDark ? "Use light theme" : "Use dark theme"}
            onClick={onThemeToggle}
            trailing={swap}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Provides unit, scenario, connection-status, and theme controls. */
export function HeaderControls({
  units,
  onUnitsChange,
  status,
  isMockSource,
  mockMode,
  onMockModeChange,
}: HeaderControlsProps) {
  const { theme, setTheme } = useTheme()
  const resolvedDark = useResolvedDark(theme)
  const toggleTheme = () => setTheme(resolvedDark ? "light" : "dark")

  return (
    <>
      <SettingsMenu
        units={units}
        onUnitsChange={onUnitsChange}
        status={status}
        isMockSource={isMockSource}
        mockMode={mockMode}
        onMockModeChange={onMockModeChange}
        isDark={resolvedDark}
        onThemeToggle={toggleTheme}
      />
      <span className="sr-only" aria-live="polite">
        {statusLabel(status)}
      </span>
    </>
  )
}
