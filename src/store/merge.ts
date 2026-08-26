/**
 * Reconciling a server snapshot against what a device has cached.
 *
 * A row that is present locally and absent from the snapshot is one of two
 * quite different things, and nothing in the cache alone tells them apart:
 *
 *   - created on this device while it could not reach the server, or
 *   - deleted on another device while this one was closed.
 *
 * The only way to know is to remember which ids the server was last seen
 * holding, and to remember it across reloads. Without that memory the set
 * starts empty on every cold start, every deletion looks like an offline
 * creation, and the device quietly resurrects rows it should have let go —
 * which is how two devices end up disagreeing about how many habits there are.
 */

export interface Snapshot<T> {
  /** The rows to keep, server first. */
  rows: T[]
  /** Local rows the server has never held — kept, and worth pushing again. */
  orphans: T[]
  /** The new set of known-server ids, to persist. */
  ids: Set<string>
}

export function mergeSnapshot<T extends { id: string }>(
  server: T[],
  local: T[],
  known: Set<string>,
): Snapshot<T> {
  const ids = new Set(server.map((r) => r.id))
  const orphans = local.filter((r) => !ids.has(r.id) && !known.has(r.id))
  return { rows: [...server, ...orphans], orphans, ids }
}
