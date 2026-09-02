/**
 * Finds the Supabase credentials in the environment.
 *
 * Names vary: the standard is NEXT_PUBLIC_SUPABASE_URL, but the Vercel
 * integration sets its own, and a prefix entered in its settings is prepended
 * to names that already carry it — producing doubled names like
 * NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_URL. Rather than chase every
 * spelling, match on shape: a Supabase URL and a JWT are both recognisable.
 */

const isSupabaseUrl = (v: string) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|red)\/?$/i.test(v.trim());

// Supabase keys are JWTs: three base64url segments separated by dots.
const isJwt = (v: string) =>
  /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.trim());

/** A service-role key bypasses RLS; an anon key does not. */
const isServiceRole = (name: string) => /SERVICE_ROLE/i.test(name);

export type Credentials = {
  url: string;
  key: string;
  urlVar: string;      // which variable it came from, for diagnostics
  keyVar: string;
  usingServiceRole: boolean;
};

type Env = Record<string, string | undefined>;

export function findSupabaseCredentials(env: Env = process.env): Credentials | null {
  const entries = Object.entries(env).filter(
    (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0
  );

  // Prefer the canonical names when present, so an explicitly set variable
  // always wins over one discovered by shape.
  const preferredUrl = entries.find(
    ([n, v]) => n === "NEXT_PUBLIC_SUPABASE_URL" && isSupabaseUrl(v)
  );
  const urlEntry =
    preferredUrl ??
    entries.find(([n, v]) => /SUPABASE/i.test(n) && isSupabaseUrl(v));
  if (!urlEntry) return null;

  const keyCandidates = entries.filter(
    ([n, v]) => /SUPABASE|ANON|SERVICE_ROLE/i.test(n) && isJwt(v)
  );
  if (!keyCandidates.length) return null;

  // A service-role key is used when present: it is the only way to write
  // without an authenticated user, which is how a single-user deploy works.
  const keyEntry =
    keyCandidates.find(([n]) => isServiceRole(n)) ??
    keyCandidates.find(([n]) => n === "NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    keyCandidates[0];

  return {
    url: urlEntry[1].trim().replace(/\/$/, ""),
    key: keyEntry[1].trim(),
    urlVar: urlEntry[0],
    keyVar: keyEntry[0],
    usingServiceRole: isServiceRole(keyEntry[0]),
  };
}

/** Variable names that look Supabase-related, for the setup diagnostics. */
export function supabaseVarNames(env: Env = process.env): string[] {
  return Object.keys(env)
    .filter((n) => /SUPABASE|POSTGRES/i.test(n))
    .sort();
}
