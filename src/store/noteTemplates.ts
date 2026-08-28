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
