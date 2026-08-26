import { describe, expect, it } from 'vitest'
import { mergeSnapshot } from './merge'

const row = (id: string) => ({ id })
const ids = (...v: string[]) => new Set(v)
const names = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('mergeSnapshot', () => {
  it('takes the server rows as the truth', () => {
    const r = mergeSnapshot([row('a'), row('b')], [], ids())
    expect(names(r.rows)).toEqual(['a', 'b'])
    expect([...r.ids]).toEqual(['a', 'b'])
  })

  it('keeps a local row the server has never held', () => {
    // Created here while offline: the server has never seen it, so it stays.
    const r = mergeSnapshot([row('a')], [row('a'), row('offline')], ids('a'))
    expect(names(r.rows)).toEqual(['a', 'offline'])
    expect(names(r.orphans)).toEqual(['offline'])
  })

  it('drops a local row the server used to hold', () => {
    // Deleted on another device while this one was closed. This is the case
    // that was being resurrected.
    const r = mergeSnapshot([row('a')], [row('a'), row('gone')], ids('a', 'gone'))
    expect(names(r.rows)).toEqual(['a'])
    expect(r.orphans).toEqual([])
  })

  it('tells the two apart in the same pass', () => {
    const r = mergeSnapshot(
      [row('a')],
      [row('a'), row('gone'), row('offline')],
      ids('a', 'gone'),
    )
    expect(names(r.rows)).toEqual(['a', 'offline'])
    expect(names(r.orphans)).toEqual(['offline'])
  })

  it('forgets ids the server no longer has', () => {
    const r = mergeSnapshot([row('a')], [], ids('a', 'gone'))
    expect([...r.ids]).toEqual(['a'])
  })

  it('re-adopts a row the server has caught up with', () => {
    // The orphan was pushed and came back in the next snapshot: it is a
    // server row now, not a local one, and must not be listed twice.
    const r = mergeSnapshot([row('a'), row('offline')], [row('a'), row('offline')], ids('a'))
    expect(names(r.rows)).toEqual(['a', 'offline'])
    expect(r.orphans).toEqual([])
  })

  it('empties out when the server has nothing and everything was synced', () => {
    const r = mergeSnapshot([], [row('a'), row('b')], ids('a', 'b'))
    expect(r.rows).toEqual([])
  })

  it('keeps everything when the cache has never synced', () => {
    // First run of a device that worked offline: nothing is known-synced, so
    // nothing may be assumed deleted.
    const r = mergeSnapshot([], [row('a'), row('b')], ids())
    expect(names(r.rows)).toEqual(['a', 'b'])
    expect(names(r.orphans)).toEqual(['a', 'b'])
  })
})
