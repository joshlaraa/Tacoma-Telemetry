/** Number of evenly spaced ticks rendered on each chart value axis. */
export const CHART_VALUE_TICK_COUNT = 4

/** Earliest visible chart time relative to the latest frame, in seconds. */
export const CHART_TIME_MIN_SECONDS = -60

/** Latest visible chart time relative to the latest frame, in seconds. */
export const CHART_TIME_MAX_SECONDS = 0

/** Fixed chart time-axis ticks relative to the latest frame, in seconds. */
export const CHART_TIME_TICKS_SECONDS = [-60, -40, -20, 0] as const

/** Minimum normalized percentage used to draw a gauge arc. */
export const GAUGE_PERCENT_MIN_PERCENT = 0

/** Maximum normalized percentage used to draw a gauge arc. */
export const GAUGE_PERCENT_MAX_PERCENT = 100

/** Gauge arc starting angle, in degrees. */
export const GAUGE_START_ANGLE_DEGREES = 225

/** Gauge arc ending angle, in degrees. */
export const GAUGE_END_ANGLE_DEGREES = -45

/** Gauge inner radius as a percentage of the chart radius. */
export const GAUGE_INNER_RADIUS_PERCENT = 72

/** Gauge outer radius as a percentage of the chart radius. */
export const GAUGE_OUTER_RADIUS_PERCENT = 100

/** Fallback close duration for the alert panel, in milliseconds. */
export const ALERT_CLOSE_FALLBACK_MS = 350

/** Fallback duration for subtle numeric changes, in milliseconds. */
export const SUBTLE_ANIMATION_FALLBACK_MS = 150

/** Fallback width-resize duration for text swaps, in milliseconds. */
export const TEXT_RESIZE_FALLBACK_MS = 250

/** Extra cleanup buffer after a tokenized animation, in milliseconds. */
export const ANIMATION_FINISH_BUFFER_MS = 40
