import { afterEach, describe, expect, it, vi } from 'vitest'
import { SUPABASE_ANON_KEY, SUPABASE_URL, resilientFetch, supabase } from './supabase'

/**
 * The point of this wrapper is one flag. A write that loses its tab mid-flight
 * is how a habit created on a phone ends up existing nowhere but that phone,
 * so it is worth pinning down which requests get to survive the page going
 * away and which do not.
 */
const seen: RequestInit[] = []
/** Statuses the stub hands back, in order; anything past the end is a 200. */
let statuses: number[] = []

vi.stubGlobal('fetch', (_input: unknown, init: RequestInit) => {
  seen.push(init)
  const status = statuses[seen.length - 1] ?? 200
  return Promise.resolve(new Response('{}', { status }))
})

afterEach(() => {
  seen.length = 0
  statuses = []
  vi.restoreAllMocks()
})

const REST = `${SUPABASE_URL}/rest/v1/clarity_tasks`

/** The header supabase-js attaches once it has resolved a session token. */
function signedIn(token = 'a.real.jwt'): RequestInit['headers'] {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
}

function bearerOf(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization')
}

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

/**
 * Both of these were read off the project's own edge logs rather than imagined:
 * 39 writes refused with 42501 in a single second because they went out
 * anonymous, and a lone PGRST303 on a page load from a token that lost a race
 * with its own refresh.
 */
describe('resilientFetch and the session', () => {
  it('refuses to send a per-user request with no session behind it', async () => {
    // supabase-js falls back to the publishable key as the bearer when it
    // cannot produce a token. Sending that is how a write gets refused and a
    // read comes back `200 []` — an empty snapshot the store would believe.
    await expect(
      resilientFetch(REST, { method: 'POST', body: '{}', headers: signedIn(SUPABASE_ANON_KEY) }),
    ).rejects.toThrow(/not signed in/i)
    expect(seen).toHaveLength(0)
  })

  it('refuses one with no Authorization header at all', async () => {
    await expect(resilientFetch(REST, { headers: { apikey: SUPABASE_ANON_KEY } })).rejects.toThrow()
    expect(seen).toHaveLength(0)
  })

  it('leaves the auth endpoints alone — signing in has no session yet', async () => {
    await resilientFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: '{}',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    expect(seen).toHaveLength(1)
    expect(seen[0].keepalive).toBe(true)
  })

  it('sends a signed-in request straight through', async () => {
    await resilientFetch(REST, { method: 'GET', headers: signedIn() })
    expect(seen).toHaveLength(1)
    expect(bearerOf(seen[0])).toBe('Bearer a.real.jwt')
  })

  it('retries a rejected token once, on a freshly minted one', async () => {
    statuses = [401]
    const refresh = vi
      .spyOn(supabase.auth, 'refreshSession')
      .mockResolvedValue({ data: { session: { access_token: 'minted.jwt' }, user: null }, error: null } as never)

    const res = await resilientFetch(REST, { method: 'GET', headers: signedIn('stale.jwt') })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(2)
    expect(bearerOf(seen[0])).toBe('Bearer stale.jwt')
    expect(bearerOf(seen[1])).toBe('Bearer minted.jwt')
    expect(res.status).toBe(200)
  })

  it('gives up after that one retry rather than looping', async () => {
    statuses = [401, 401]
    vi.spyOn(supabase.auth, 'refreshSession').mockResolvedValue({
      data: { session: { access_token: 'minted.jwt' }, user: null },
      error: null,
    } as never)

    const res = await resilientFetch(REST, { method: 'GET', headers: signedIn('stale.jwt') })
    expect(seen).toHaveLength(2)
    expect(res.status).toBe(401)
  })

  it('hands back the 401 when the session cannot be renewed', async () => {
    statuses = [401]
    vi.spyOn(supabase.auth, 'refreshSession').mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as never)

    const res = await resilientFetch(REST, { method: 'GET', headers: signedIn('stale.jwt') })
    expect(seen).toHaveLength(1)
    expect(res.status).toBe(401)
  })

  it('refreshes once for a burst that all fail together', async () => {
    statuses = [401, 401, 401]
    const refresh = vi
      .spyOn(supabase.auth, 'refreshSession')
      .mockResolvedValue({ data: { session: { access_token: 'minted.jwt' }, user: null }, error: null } as never)

    await Promise.all(
      ['a', 'b', 'c'].map((id) =>
        resilientFetch(REST, { method: 'POST', body: `{"id":"${id}"}`, headers: signedIn('stale.jwt') }),
      ),
    )

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(6)
  })
})
