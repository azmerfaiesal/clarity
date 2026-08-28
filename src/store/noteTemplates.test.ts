import { describe, expect, it } from 'vitest'
import {
  NOTE_TEMPLATES,
  builtInById,
  isBuiltIn,
  mergeTemplates,
  type NoteTemplateRow,
} from './noteTemplates'

/**
 * The picker is a merge of two things that look the same on screen and are not
 * the same underneath: constants that ship with the app, and rows that exist
 * only where one has been changed. Everything worth getting wrong lives here.
 */

function row(over: Partial<NoteTemplateRow> & { id: string }): NoteTemplateRow {
  return {
    name: 'Row',
    blurb: '',
    tags: [],
    body: '',
    hidden: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('mergeTemplates', () => {
  it('shows the shipped set when nothing has been touched', () => {
    expect(mergeTemplates([]).map((t) => t.id)).toEqual(NOTE_TEMPLATES.map((t) => t.id))
    expect(mergeTemplates([]).every((t) => !t.edited && !t.custom)).toBe(true)
  })

  it('lets a stored row stand in for the built-in it names', () => {
    const merged = mergeTemplates([row({ id: 'coffee', name: 'Pourover', body: 'Grinder: ' })])
    const coffee = merged.find((t) => t.id === 'coffee')
    expect(coffee).toMatchObject({ name: 'Pourover', body: 'Grinder: ', edited: true })
    // and does not disturb the rest
    expect(merged).toHaveLength(NOTE_TEMPLATES.length)
  })

  it('keeps the built-in order however the rows arrive', () => {
    const shuffled = [row({ id: 'spending' }), row({ id: 'list' })]
    expect(mergeTemplates(shuffled).map((t) => t.id)).toEqual(NOTE_TEMPLATES.map((t) => t.id))
  })

  it('drops a built-in that has been put away', () => {
    const merged = mergeTemplates([row({ id: 'list', hidden: true })])
    expect(merged.some((t) => t.id === 'list')).toBe(false)
    expect(merged).toHaveLength(NOTE_TEMPLATES.length - 1)
  })

  it('appends written-from-scratch ones after the built-ins, in their own order', () => {
    const merged = mergeTemplates([
      row({ id: 'mine-b', name: 'B', sortOrder: 2 }),
      row({ id: 'mine-a', name: 'A', sortOrder: 1 }),
    ])
    expect(merged.slice(-2).map((t) => t.name)).toEqual(['A', 'B'])
    expect(merged.slice(-2).every((t) => t.custom)).toBe(true)
  })

  it('hides a custom one rather than showing an empty row', () => {
    expect(mergeTemplates([row({ id: 'mine', hidden: true })])).toHaveLength(NOTE_TEMPLATES.length)
  })

  it('never marks a built-in as custom, or a custom one as edited', () => {
    const merged = mergeTemplates([row({ id: 'coffee' }), row({ id: 'mine' })])
    expect(merged.find((t) => t.id === 'coffee')?.custom).toBeUndefined()
    expect(merged.find((t) => t.id === 'mine')?.edited).toBeUndefined()
  })
})

describe('built-in identity', () => {
  it('recognises the shipped ids and nothing else', () => {
    expect(isBuiltIn('coffee')).toBe(true)
    expect(isBuiltIn('some-generated-id')).toBe(false)
  })

  it('hands back the original shape, which is what reset restores to', () => {
    // The constant has to survive being overridden — reset drops the row and
    // relies on this still being the shipped text.
    const shipped = builtInById('coffee')
    mergeTemplates([row({ id: 'coffee', name: 'Pourover', body: 'nothing like it' })])
    expect(builtInById('coffee')).toEqual(shipped)
    expect(shipped?.body).toContain('Bean:')
  })
})

describe('sort order', () => {
  it('stays inside what the column can hold', () => {
    // `Date.now()` is the stamp used for a new template's order. It overflows
    // int4 by three orders of magnitude, which is what made every save a
    // silent 400 until the column was widened — so pin the expectation.
    expect(Date.now()).toBeGreaterThan(2_147_483_647)
    expect(Date.now()).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})
