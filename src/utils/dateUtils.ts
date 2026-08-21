/** Date helpers — all operate on local-time `yyyy-mm-dd` strings. */

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isToday(dateStr: string | null): boolean {
  return dateStr === todayStr()
}

export function isOverdue(dateStr: string | null): boolean {
  return !!dateStr && dateStr < todayStr()
}

export function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false
  const today = todayStr()
  return dateStr >= today && dateStr <= addDays(today, days)
}

export type DueLabel = { text: string; tone: 'overdue' | 'today' | 'future' | 'none' }

export function formatDueDate(dateStr: string | null): DueLabel | null {
  if (!dateStr) return null
  const today = todayStr()
  if (dateStr === today) return { text: 'Today', tone: 'today' }
  if (dateStr === addDays(today, 1)) return { text: 'Tomorrow', tone: 'future' }
  if (dateStr === addDays(today, -1)) return { text: 'Yesterday', tone: 'overdue' }
  if (dateStr < today) {
    const d = parseDate(dateStr)
    return {
      text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tone: 'overdue',
    }
  }
  const d = parseDate(dateStr)
  const diffMs = d.getTime() - parseDate(today).getTime()
  const diffDays = Math.round(diffMs / 86_400_000)
  if (diffDays < 7) {
    return {
      text: d.toLocaleDateString(undefined, { weekday: 'short' }),
      tone: 'future',
    }
  }
  return {
    text: d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
    }),
    tone: 'future',
  }
}

/** Section label used for grouping in the Upcoming view. */
export function sectionLabel(dateStr: string): string {
  const label = formatDueDate(dateStr)
  const d = parseDate(dateStr)
  const full = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  if (label && (label.text === 'Today' || label.text === 'Tomorrow' || label.text === 'Yesterday')) {
    return `${label.text} · ${full}`
  }
  return full
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
