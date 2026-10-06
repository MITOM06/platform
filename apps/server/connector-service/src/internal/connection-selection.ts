export interface SelectableConnection {
  provider: string;
  userId: string;
  scope?: string;
  createdAt?: Date | string;
  _id?: unknown;
}

/** Creation time of a connection (createdAt, else the ObjectId timestamp, else 0). */
export function createdTime(c: SelectableConnection): number {
  if (c.createdAt) {
    const t = new Date(c.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  const id = c._id as { getTimestamp?: () => Date } | string | undefined;
  if (id && typeof id === 'object' && typeof id.getTimestamp === 'function') {
    return id.getTimestamp().getTime();
  }
  const hex = typeof id === 'string' ? id : id ? String(id) : '';
  return /^[0-9a-f]{24}$/i.test(hex) ? Number.parseInt(hex.slice(0, 8), 16) * 1000 : 0;
}

/**
 * Exactly one connection per provider, the same rule for listing and calling:
 * the member's own connection wins; otherwise the NEWEST workspace connection.
 * Legacy data can hold several workspace connections for one provider (one per
 * admin); exposing all of them produced duplicate tool names and a 400 from
 * the model API for every member. Insertion order (first sighting of each
 * provider) is preserved.
 */
export function pickConnections<T extends SelectableConnection>(conns: readonly T[], userId: string): T[] {
  const chosen = new Map<string, T>();
  for (const c of conns) {
    const current = chosen.get(c.provider);
    if (!current) {
      chosen.set(c.provider, c);
      continue;
    }
    const currentOwn = current.userId === userId;
    const candidateOwn = c.userId === userId;
    if (currentOwn) continue;
    if (candidateOwn || createdTime(c) > createdTime(current)) chosen.set(c.provider, c);
  }
  return [...chosen.values()];
}
