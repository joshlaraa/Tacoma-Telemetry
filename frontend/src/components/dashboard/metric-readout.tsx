import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { cn } from "cn"

type MetricReadoutProps = {
  value: string
  className?: string
}

type NumberAnimation = {
  previous: string
  next: string
  direction: 1 | -1
  active: boolean
}

export function MetricReadout({ value, className }: MetricReadoutProps) {
  const previousValue = useRef(value)
  const [animation, setAnimation] = useState<NumberAnimation | null>(null)

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
    const timer = window.setTimeout(() => setAnimation(null), 520)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [value])

  const previous = animation?.previous ?? value
  const next = animation?.next ?? value
  const sameLength = previous.length === next.length
  const renderedValue = [...next].map((character, index) => {
    if (sameLength && previous[index] === character) {
      return character
    }

    return (
      <span className="t-subtle-slot" key={`${index}-${character}`}>
        {sameLength ? (
          <span className="t-subtle-old" aria-hidden="true">
            {previous[index]}
          </span>
        ) : null}
        <span className="t-subtle-new">{character}</span>
      </span>
    )
  })

  return (
    <span
      className={cn(
        "t-subtle-number font-mono font-semibold tabular-nums",
        animation?.active && "is-animating",
        className
      )}
      style={
        {
          "--subtle-dir": animation?.direction ?? 1,
        } as CSSProperties
      }
      aria-label={next}
      aria-live="polite"
    >
      {renderedValue}
    </span>
  )
}
