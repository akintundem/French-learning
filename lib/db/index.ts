import type { Store } from "./types";

declare global {
  var __store: Store | undefined;
}

/**
 * Picks the backend from the environment.
 *
 * Supabase when both variables are set — which is how it runs on Vercel, where
 * the filesystem is ephemeral and a SQLite file would be empty on every
 * request. SQLite otherwise, for local development.
 *
 * better-sqlite3 is a native module that cannot build in a serverless runtime,
 * so it is imported lazily: the branch below is never evaluated in production.
 */
export function getStore(): Store {
  if (globalThis.__store) return globalThis.__store;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseStore } = require("./supabase") as typeof import("./supabase");
    globalThis.__store = new SupabaseStore(url, key);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteStore } = require("./sqlite") as typeof import("./sqlite");
    globalThis.__store = new SqliteStore();
  }

  return globalThis.__store;
}

/** Which backend is active — surfaced so a misconfigured deploy is obvious. */
export function storeKind(): "supabase" | "sqlite" {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ? "supabase"
    : "sqlite";
}

export type { Store };
