import { afterEach, describe, expect, it, vi } from 'vitest'
import { resilientFetch } from './supabase'

/**
 * The point of this wrapper is one flag. A write that loses its tab mid-flight
 * is how a habit created on a phone ends up existing nowhere but that phone,
 * so it is worth pinning down which requests get to survive the page going
 * away and which do not.
 */
const seen: RequestInit[] = []

vi.stubGlobal('fetch', (_input: unknown, init: RequestInit) => {
  seen.push(init)
  return Promise.resolve(new Response('{}'))
})

afterEach(() => {
  seen.length = 0
})

describe('resilientFetch', () => {
  it('keeps a write alive across the page being suspended', async () => {
    await resilientFetch('https://example.test/rows', {
      method: 'POST',
      body: JSON.stringify({ id: 'h1' }),
    })
    expect(seen[0].keepalive).toBe(true)
  })

  it('covers the other write verbs too', async () => {
    for (const method of ['PATCH', 'DELETE', 'PUT']) {
      await resilientFetch('https://example.test/rows', { method, body: '{}' })
    }
    expect(seen.map((i) => i.keepalive)).toEqual([true, true, true])
  })

  it('leaves reads alone — they can simply be asked again', async () => {
    await resilientFetch('https://example.test/rows', { method: 'GET' })
    await resilientFetch('https://example.test/rows')
    expect(seen.map((i) => i?.keepalive)).toEqual([undefined, undefined])
  })

  it('falls back to a normal fetch past the 64KB keepalive cap', async () => {
    // Over the cap the browser rejects the request outright, which would be a
    // worse failure than the one this is guarding against.
    await resilientFetch('https://example.test/rows', {
      method: 'POST',
      body: 'x'.repeat(70_000),
    })
    expect(seen[0].keepalive).toBeUndefined()
  })

  it('passes the rest of the request through untouched', async () => {
    await resilientFetch('https://example.test/rows', {
      method: 'POST',
      body: '{}',
      headers: { apikey: 'k' },
    })
    expect(seen[0].headers).toEqual({ apikey: 'k' })
    expect(seen[0].method).toBe('POST')
  })
})
