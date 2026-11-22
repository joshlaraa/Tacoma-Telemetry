import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { cn } from "cn"

import {
  ANIMATION_FINISH_BUFFER_MS,
  SUBTLE_ANIMATION_FALLBACK_MS,
} from "./dashboard-constants"

type MetricReadoutProps = {
  value: string
  className?: string
}

type SubtleNumberStyle = CSSProperties & {
  "--subtle-dir": number
}

type NumberAnimation = {
  previous: string
  next: string
  direction: 1 | -1
  active: boolean
}

/** Displays a numeric string with a quiet tokenized change transition. */
export function MetricReadout({ value, className }: MetricReadoutProps) {
  const previousValue = useRef(value)
  const [animation, setAnimation] = useState<NumberAnimation | null>(null)
  const subtleNumberStyle: SubtleNumberStyle = {
    "--subtle-dir": animation?.direction ?? 1,
  }

  useEffect(() => {
    if (value === previousValue.current) {
      return
    }

    const previous = previousValue.current
    previousValue.current = value
    const direction =
      Number(value.replace(/[^\d.-]/g, "")) >=
      Number(previous.replace(/[^\d.-]/g, ""))
        ? 1
        : -1

    setAnimation({
      previous,
      next: value,
      direction,
      active: false,
    })

    const frame = window.requestAnimationFrame(() => {
      setAnimation((current) =>
        current ? { ...current, active: true } : current
      )
    })
    const styles = getComputedStyle(document.documentElement)
    const duration =
      Number.parseFloat(styles.getPropertyValue("--subtle-dur")) ||
      SUBTLE_ANIMATION_FALLBACK_MS
    const timer = window.setTimeout(
      () => setAnimation(null),
      duration + ANIMATION_FINISH_BUFFER_MS
    )

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [value])

  const previous = animation?.previous ?? value
  const next = animation?.next ?? value
  const sameLength = previous.length === next.length
  const renderedValue = sameLength ? (
    [...next].map((character, index) => {
      if (previous[index] === character) {
        return character
      }

      return (
        <span className="t-subtle-slot" key={`${index}-${character}`}>
          <span className="t-subtle-old" aria-hidden="true">
            {previous[index]}
          </span>
          <span className="t-subtle-new">{character}</span>
        </span>
      )
    })
  ) : (
    <span className="t-subtle-slot">
      <span className="t-subtle-old" aria-hidden="true">
        {previous}
      </span>
      <span className="t-subtle-new">{next}</span>
    </span>
  )

  return (
    <span
      className={cn(
        "t-subtle-number font-mono font-semibold tabular-nums",
        animation?.active && "is-animating",
        className
      )}
      style={subtleNumberStyle}
      aria-label={next}
    >
      {renderedValue}
    </span>
  )
}
