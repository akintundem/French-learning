import { SqliteStore } from "./sqlite";
import type { Store } from "./types";

// One instance per process. Next's dev server reloads modules, so it is
// cached on globalThis to avoid opening a new handle on every hot reload.
declare global {
  var __store: Store | undefined;
}

/**
 * The single place that decides which backend is in use. To move to Supabase,
 * add a SupabaseStore implementing Store and switch on an env var here —
 * nothing else in the app touches SQL.
 */
export function getStore(): Store {
  if (!globalThis.__store) globalThis.__store = new SqliteStore();
  return globalThis.__store;
}

export type { Store };
