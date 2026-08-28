/**
 * Starting shapes for a note.
 *
 * The blank sheet is the point of this page, and most days it is the right
 * thing. But a blank sheet is also why a recurring log — what you drank, what
 * you read, what the shopping is — never gets written the same way twice, and
 * a log you cannot compare across days is not much of a log. These are the
 * scaffolding for the handful that repeat.
 *
 * Notes are stored and shown as plain text; nothing here is parsed. The `[ ]`
 * boxes are characters you overwrite with an `x`, not controls — which is worth
 * knowing before you expect one to be tickable.
 *
 * They are constants rather than rows in a table: unlike habit templates these
 * are not authored by anyone, so there is nothing to sync and nothing to lose.
 */

export interface NoteTemplate {
  id: string
  name: string
  /** One line on what it is for, shown under the name in the picker. */
  blurb: string
  /** Tags applied along with the body, so a log is filterable from day one. */
  tags: string[]
  body: string
  /** False for the six shipped here; true for anything the reader wrote. */
  custom?: boolean
  /** True when this one has been edited away from the shape it shipped with. */
  edited?: boolean
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'list',
    name: 'List',
    blurb: 'A plain run of bullets for anything that is simply several things.',
    tags: [],
    body: ['• ', '• ', '• '].join('\n'),
  },
  {
    id: 'checklist',
    name: 'Shopping list',
    blurb: 'Boxes to cross off. Replace a space with an x as you go.',
    tags: ['shopping'],
    body: [
      'Shopping',
      '',
      '[ ] ',
      '[ ] ',
      '[ ] ',
      '',
      'Total: ',
    ].join('\n'),
  },
  {
    id: 'daily',
    name: 'Daily log',
    blurb: 'How the day went, in four prompts you can answer in a sentence each.',
    tags: ['daily log'],
    body: [
      'Today',
      '',
      'Did: ',
      'Felt: ',
      'Ate: ',
      'Tomorrow: ',
    ].join('\n'),
  },
  {
    id: 'reading',
    name: 'Reading log',
    blurb: 'What you read and what stayed with you, so the notes outlast the book.',
    tags: ['reading'],
    body: [
      'Book: ',
      'Pages: ',
      'Minutes: ',
      '',
      'What stuck:',
      '• ',
      '',
      'Worth coming back to: ',
    ].join('\n'),
  },
  {
    id: 'coffee',
    name: 'Coffee brew',
    blurb: 'The variables worth writing down, so a good cup can be repeated.',
    tags: ['coffee'],
    body: [
      'Bean: ',
      'Roast: ',
      'Method: ',
      '',
      'Dose: g',
      'Water: g',
      'Grind: ',
      'Temp: °C',
      'Time: ',
      '',
      'Tastes like: ',
      'Next time: ',
    ].join('\n'),
  },
  {
    id: 'spending',
    name: 'Spending log',
    blurb: 'What went out today, and what it came to.',
    tags: ['spending log'],
    body: [
      'Spending',
      '',
      '• — RM',
      '• — RM',
      '',
      'Total: RM',
    ].join('\n'),
  },
]

/** A stored row: an edit of a built-in, or one the reader wrote themselves. */
export interface NoteTemplateRow {
  id: string
  name: string
  blurb: string
  tags: string[]
  body: string
  /** Set on a built-in that has been put away rather than edited. */
  hidden: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const BUILT_IN_IDS = new Set(NOTE_TEMPLATES.map((t) => t.id))

export function isBuiltIn(id: string): boolean {
  return BUILT_IN_IDS.has(id)
}

/**
 * What the picker shows: the built-ins, each replaced by its stored edit and
 * skipped where it has been put away, then anything written from scratch.
 *
 * Overriding by id rather than storing the whole list is what lets a built-in
 * be repaired or added to in a later release without stepping on an edit — and
 * makes "reset" nothing more than deleting the row.
 */
export function mergeTemplates(rows: NoteTemplateRow[]): NoteTemplate[] {
  const byId = new Map(rows.map((r) => [r.id, r]))

  const builtIns: NoteTemplate[] = []
  for (const template of NOTE_TEMPLATES) {
    const row = byId.get(template.id)
    if (!row) {
      builtIns.push(template)
      continue
    }
    if (row.hidden) continue
    builtIns.push({
      id: row.id,
      name: row.name,
      blurb: row.blurb,
      tags: row.tags,
      body: row.body,
      edited: true,
    })
  }

  const custom = rows
    .filter((r) => !isBuiltIn(r.id) && !r.hidden)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map<NoteTemplate>((r) => ({
      id: r.id,
      name: r.name,
      blurb: r.blurb,
      tags: r.tags,
      body: r.body,
      custom: true,
    }))

  return [...builtIns, ...custom]
}

/** The shape a built-in shipped with, for "reset" and for the edit form. */
export function builtInById(id: string): NoteTemplate | undefined {
  return NOTE_TEMPLATES.find((t) => t.id === id)
}
