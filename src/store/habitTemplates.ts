import type { HabitTemplate } from '../types'

/**
 * Built-in starting points, shaped as templates so the sidebar can list them
 * beside the ones you save and treat both the same way. Their ids are prefixed
 * rather than generated: they are not stored anywhere, and a stable id is what
 * lets React keep the rows and the rest of the app tell a suggestion from a
 * saved template without a second flag.
 */
const SUGGESTION_EPOCH = '2026-01-01T00:00:00.000Z'

export const SUGGESTION_PREFIX = 'suggest:'

export function isSuggestion(t: HabitTemplate): boolean {
  return t.id.startsWith(SUGGESTION_PREFIX)
}

function suggestion(
  slug: string,
  name: string,
  icon: string,
  color: string,
  over: Partial<HabitTemplate> = {},
): HabitTemplate {
  return {
    id: `${SUGGESTION_PREFIX}${slug}`,
    name,
    description: '',
    icon,
    color,
    repetitionType: 'daily',
    daysOfWeek: [],
    datesOfMonth: [],
    timesPerWeek: null,
    trackBy: 'checkoff',
    dailyTarget: null,
    createdAt: SUGGESTION_EPOCH,
    ...over,
  }
}

export const SUGGESTED_TEMPLATES: HabitTemplate[] = [
  suggestion('exercise', 'Exercise', 'lucide:dumbbell', '#fecaca', {
    repetitionType: 'timesPerWeek',
    timesPerWeek: 3,
    trackBy: 'duration',
    dailyTarget: 30,
  }),
  suggestion('read', 'Read', 'lucide:book', '#a5f3fc', {
    trackBy: 'duration',
    dailyTarget: 20,
  }),
  suggestion('meditate', 'Meditate', 'lucide:brain', '#e9d5ff', {
    trackBy: 'duration',
    dailyTarget: 10,
  }),
  suggestion('water', 'Drink water', 'lucide:water', '#bfdbfe', {
    trackBy: 'count',
    dailyTarget: 8,
  }),
  suggestion('stretch', 'Stretch', 'lucide:activity', '#bbf7d0', {
    repetitionType: 'weekly',
    daysOfWeek: [1, 3, 5],
  }),
  suggestion('review', 'Weekly review', 'lucide:notebook', '#fde68a', {
    repetitionType: 'weekly',
    daysOfWeek: [0],
  }),
]
