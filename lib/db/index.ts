import { findSupabaseCredentials } from "./env";
import type { Store } from "./types";

declare global {
  var __store: Store | undefined;
}

/**
 * Picks the backend from the environment.
 *
 * Supabase when credentials are found — which is how it runs on Vercel, where
 * the filesystem is ephemeral and a SQLite file would be empty on every
 * request. SQLite otherwise, for local development.
 *
 * Credentials are matched by shape rather than by one exact variable name, so
 * whatever the Vercel integration happens to call them, they are found. See
 * lib/db/env.ts.
 *
 * better-sqlite3 is a native module that cannot build in a serverless runtime,
 * so both stores are required lazily: only one branch is ever evaluated.
 */
export function getStore(): Store {
  if (globalThis.__store) return globalThis.__store;

  const creds = findSupabaseCredentials();

  if (creds) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseStore } = require("./supabase") as typeof import("./supabase");
    globalThis.__store = new SupabaseStore(creds.url, creds.key);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteStore } = require("./sqlite") as typeof import("./sqlite");
    globalThis.__store = new SqliteStore();
  }

  return globalThis.__store;
}

/** Which backend is active — surfaced so a misconfigured deploy is obvious. */
export function storeKind(): "supabase" | "sqlite" {
  return findSupabaseCredentials() ? "supabase" : "sqlite";
}

export type { Store };
