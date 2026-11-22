import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

type SoftTextProps = {
  value: string
  className?: string
}

type TextSwap = {
  previous: string
  next: string
  active: boolean
}

export function SoftText({ value, className }: SoftTextProps) {
  const previousValue = useRef(value)
  const [swap, setSwap] = useState<TextSwap | null>(null)

  useEffect(() => {
    if (value === previousValue.current) {
      return
    }

    const previous = previousValue.current
    previousValue.current = value
    setSwap({ previous, next: value, active: false })

    const frame = window.requestAnimationFrame(() => {
      setSwap((current) => (current ? { ...current, active: true } : current))
    })
    const timer = window.setTimeout(() => setSwap(null), 240)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [value])

  if (!swap) {
    return <span className={className}>{value}</span>
  }

  return (
    <span
      className={cn("t-text-soft", swap.active && "is-swapping", className)}
      aria-label={swap.next}
    >
      <span className="t-text-soft-old" aria-hidden="true">
        {swap.previous}
      </span>
      <span className="t-text-soft-new">{swap.next}</span>
    </span>
  )
}
