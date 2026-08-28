/**
 * How brightly a streak burns, as 0 → 1.
 *
 * Sub-linear on purpose: a linear ramp against a 30-day target leaves the first
 * week indistinguishable from nothing, which is exactly the week the encouraging
 * signal is worth most. The square root gives day three a third of the glow.
 *
 * Shared by the flame and the habit icon so the two never disagree about how
 * far along the same streak is.
 */
export function beamIntensity(streak: number, peak = 30): number {
  return Math.min(1, Math.sqrt(Math.max(0, streak) / Math.max(1, peak)))
}
