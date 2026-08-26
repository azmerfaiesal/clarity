import { beforeEach, describe, expect, it } from 'vitest'
import { clearSyncError, reportSyncError, reportSyncOk, syncHealth } from './syncHealth'

/**
 * What matters here is that a refusal is kept and can be shown. A write the
 * server rejects will never succeed on a retry, and swallowing it once cost
 * days of a habit that existed on exactly one device.
 */
beforeEach(() => {
  reportSyncOk()
})

describe('sync health', () => {
  it('keeps the operation and the server’s own words', () => {
    reportSyncError('saving a habit', { message: 'value out of range for type integer' })
    expect(syncHealth().ok).toBe(false)
    expect(syncHealth().lastError).toContain('saving a habit')
    expect(syncHealth().lastError).toContain('out of range')
  })

  it('handles a thrown Error as well as a returned one', () => {
    reportSyncError('saving a note', new Error('Failed to fetch'))
    expect(syncHealth().lastError).toContain('Failed to fetch')
  })

  it('recovers when a later call succeeds', () => {
    reportSyncError('saving a task', { message: 'nope' })
    expect(syncHealth().ok).toBe(false)
    reportSyncOk()
    expect(syncHealth().ok).toBe(true)
    expect(syncHealth().lastError).toBeNull()
  })

  it('remembers when things last worked, through a failure', () => {
    const okAt = syncHealth().lastOkAt
    expect(okAt).not.toBeNull()
    reportSyncError('loading habits', { message: 'nope' })
    expect(syncHealth().lastOkAt).toBe(okAt)
  })

  it('caps a runaway message rather than storing all of it', () => {
    reportSyncError('saving a task', { message: 'x'.repeat(5000) })
    expect(syncHealth().lastError!.length).toBeLessThanOrEqual(300)
  })

  it('only resets a failure, never a healthy state', () => {
    clearSyncError()
    expect(syncHealth().ok).toBe(true)
    reportSyncError('saving a list', { message: 'nope' })
    clearSyncError()
    expect(syncHealth().ok).toBeNull()
  })
})
