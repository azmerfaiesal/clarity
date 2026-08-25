import {
  Activity, Apple, Ban, Bed, Bike, Book, BookOpen, Brain, Brush, Candy, CheckCircle2, ChefHat,
  CigaretteOff, Clock, Cloud, Code, Coffee, Cookie, Croissant, Dumbbell, Feather, Flame, Footprints,
  GlassWater, Guitar, Heart, Languages, Leaf, Lightbulb, Moon, Music, Notebook, PawPrint, Pencil,
  PenLine, PhoneOff, Pill, Pizza, Rocket, Salad, Scale, Send, Smile, Sparkles, Sprout, Star, Sun,
  Sunrise, Target, Timer, Trophy, Tv, Users, Wallet, Waves, Wine, Zap, type LucideIcon,
} from 'lucide-react'

/**
 * Curated line icons for habits, grouped the way people think about habits
 * rather than alphabetically. Stored as `lucide:<key>`; anything else in the
 * field is treated as a literal emoji, so both kinds of icon share one column.
 */
export const ICON_GROUPS: { label: string; icons: [string, LucideIcon, string][] }[] = [
  {
    label: 'Popular',
    icons: [
      ['check', CheckCircle2, 'check'], ['target', Target, 'target'], ['flame', Flame, 'streak'],
      ['star', Star, 'star'], ['heart', Heart, 'heart'], ['zap', Zap, 'energy'],
      ['trophy', Trophy, 'trophy'], ['rocket', Rocket, 'rocket'], ['sparkles', Sparkles, 'sparkle'],
      ['sunrise', Sunrise, 'sunrise'], ['moon', Moon, 'night'], ['coffee', Coffee, 'coffee'],
      ['clock', Clock, 'time'], ['smile', Smile, 'mood'],
    ],
  },
  {
    label: 'Quit bad habits',
    icons: [
      ['ban', Ban, 'quit'], ['nosmoke', CigaretteOff, 'smoking'], ['wine', Wine, 'wine'],
      ['candy', Candy, 'sweets'], ['cookie', Cookie, 'cookie'], ['pizza', Pizza, 'junk food'],
      ['croissant', Croissant, 'pastry'], ['phoneoff', PhoneOff, 'phone'], ['tv', Tv, 'tv'],
    ],
  },
  {
    label: 'Fitness & health',
    icons: [
      ['dumbbell', Dumbbell, 'gym'], ['bike', Bike, 'cycling'], ['footprints', Footprints, 'steps'],
      ['activity', Activity, 'cardio'], ['waves', Waves, 'swim'], ['scale', Scale, 'weight'],
      ['water', GlassWater, 'water'], ['salad', Salad, 'salad'], ['apple', Apple, 'fruit'],
      ['pill', Pill, 'vitamins'], ['bed', Bed, 'sleep'], ['chef', ChefHat, 'cooking'],
    ],
  },
  {
    label: 'Mind & learning',
    icons: [
      ['book', Book, 'read'], ['bookopen', BookOpen, 'study'], ['brain', Brain, 'meditate'],
      ['notebook', Notebook, 'journal'], ['pen', PenLine, 'write'], ['pencil', Pencil, 'draw'],
      ['languages', Languages, 'language'], ['lightbulb', Lightbulb, 'ideas'],
      ['code', Code, 'code'], ['feather', Feather, 'writing'],
    ],
  },
  {
    label: 'Life',
    icons: [
      ['leaf', Leaf, 'nature'], ['sprout', Sprout, 'grow'], ['sun', Sun, 'outdoors'],
      ['cloud', Cloud, 'calm'], ['music', Music, 'music'], ['guitar', Guitar, 'practice'],
      ['brush', Brush, 'art'], ['wallet', Wallet, 'money'], ['users', Users, 'people'],
      ['send', Send, 'reach out'], ['paw', PawPrint, 'pets'], ['timer', Timer, 'focus'],
    ],
  },
]

const BY_KEY = new Map<string, LucideIcon>()
for (const g of ICON_GROUPS) for (const [key, Icon] of g.icons) BY_KEY.set(key, Icon)

export const EMOJI = [
  '📚', '🏃', '🧘', '💧', '💪', '🎧', '✍️', '🌱', '🛏️', '🥗', '🧹', '💰',
  '☀️', '🌙', '🔥', '⭐', '❤️', '⚡', '🏆', '🎯', '🚀', '☕', '🍎', '🚴',
]

export function isLucideIcon(icon: string): boolean {
  return icon.startsWith('lucide:')
}

/** Search across icon keys and their plain-language aliases. */
export function searchIcons(query: string): [string, LucideIcon, string][] {
  const q = query.trim().toLowerCase()
  const all = ICON_GROUPS.flatMap((g) => g.icons)
  if (!q) return []
  return all.filter(([key, , alias]) => key.includes(q) || alias.includes(q))
}

/** Renders whichever kind of icon the habit holds, or a fallback. */
export function HabitIcon({
  icon,
  className = 'h-4 w-4',
  fallback,
}: {
  icon: string
  className?: string
  fallback?: React.ReactNode
}) {
  if (isLucideIcon(icon)) {
    const Icon = BY_KEY.get(icon.slice(7))
    if (Icon) return <Icon className={className} strokeWidth={1.75} aria-hidden />
  }
  if (icon) return <span aria-hidden>{icon}</span>
  return <>{fallback ?? null}</>
}
