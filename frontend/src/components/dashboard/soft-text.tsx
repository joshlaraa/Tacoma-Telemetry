import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

import {
  ANIMATION_FINISH_BUFFER_MS,
  SUBTLE_ANIMATION_FALLBACK_MS,
  TEXT_RESIZE_FALLBACK_MS,
} from "./dashboard-constants"

type SoftTextProps = {
  value: string
  className?: string
}

type TextSwap = {
  previous: string
  next: string
  active: boolean
}

/** Swaps short labels without changing the surrounding layout abruptly. */
export function SoftText({ value, className }: SoftTextProps) {
  const previousValue = useRef(value)
  const containerRef = useRef<HTMLSpanElement>(null)
  const oldRef = useRef<HTMLSpanElement>(null)
  const newRef = useRef<HTMLSpanElement>(null)
  const [swap, setSwap] = useState<TextSwap | null>(null)

  useEffect(() => {
    if (value === previousValue.current) {
      return
    }

    const previous = previousValue.current
    previousValue.current = value
    setSwap({ previous, next: value, active: false })

    let finishTimer = 0
    let resizeFrame = 0
    const measureFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      const oldText = oldRef.current
      const newText = newRef.current
      if (!container || !oldText || !newText) {
        return
      }

      container.style.width = `${oldText.getBoundingClientRect().width}px`
      void container.offsetWidth
      resizeFrame = window.requestAnimationFrame(() => {
        container.style.width = `${newText.getBoundingClientRect().width}px`
        setSwap((current) => (current ? { ...current, active: true } : current))
      })
      const styles = getComputedStyle(document.documentElement)
      const textDuration =
        Number.parseFloat(styles.getPropertyValue("--text-soft-dur")) ||
        SUBTLE_ANIMATION_FALLBACK_MS
      const resizeDuration =
        Number.parseFloat(styles.getPropertyValue("--text-soft-resize-dur")) ||
        TEXT_RESIZE_FALLBACK_MS
      finishTimer = window.setTimeout(
        () => {
          container.style.width = "auto"
          setSwap(null)
        },
        Math.max(textDuration, resizeDuration) + ANIMATION_FINISH_BUFFER_MS
      )
    })

    return () => {
      window.cancelAnimationFrame(measureFrame)
      window.cancelAnimationFrame(resizeFrame)
      window.clearTimeout(finishTimer)
    }
  }, [value])

  if (!swap) {
    return <span className={className}>{value}</span>
  }

  return (
    <span
      ref={containerRef}
      className={cn("t-text-soft", swap.active && "is-swapping", className)}
      aria-label={swap.next}
    >
      <span ref={oldRef} className="t-text-soft-old" aria-hidden="true">
        {swap.previous}
      </span>
      <span ref={newRef} className="t-text-soft-new">
        {swap.next}
      </span>
    </span>
  )
}
