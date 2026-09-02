import { describe, expect, it } from "vitest";
import { findSupabaseCredentials, supabaseVarNames } from "@/lib/db/env";

// A syntactically valid JWT — structure only, not a real credential.
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl";
const URL_ = "https://abcdefgh.supabase.co";

describe("finding credentials whatever they are called", () => {
  it("uses the canonical names", () => {
    const c = findSupabaseCredentials({
      NEXT_PUBLIC_SUPABASE_URL: URL_,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: JWT,
    });

    expect(c).toMatchObject({ url: URL_, key: JWT, usingServiceRole: false });
  });

  it("handles the doubled names the Vercel integration can produce", () => {
    // A prefix entered in the integration settings is prepended to names that
    // already carry it: NEXT_PUBLIC_ + NEXT_PUBLIC_SUPABASE_ + SUPABASE_URL.
    const c = findSupabaseCredentials({
      NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_URL: URL_,
      NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_ANON_KEY: JWT,
    });

    expect(c?.url).toBe(URL_);
    expect(c?.key).toBe(JWT);
    expect(c?.urlVar).toBe("NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_URL");
  });

  it("handles the integration's unprefixed names", () => {
    const c = findSupabaseCredentials({
      SUPABASE_URL: URL_,
      SUPABASE_ANON_KEY: JWT,
    });

    expect(c?.url).toBe(URL_);
    expect(c?.key).toBe(JWT);
  });

  it("prefers the canonical name when several URLs are present", () => {
    const c = findSupabaseCredentials({
      NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_URL: "https://wrong.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: URL_,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: JWT,
    });

    expect(c?.url).toBe(URL_);
  });

  it("prefers the anon key, so a stray service-role key is not used", () => {
    // The schema grants the anon key what the app needs; a service-role key
    // bypasses RLS entirely and should not be picked up by accident.
    const service = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2ln";
    const c = findSupabaseCredentials({
      SUPABASE_URL: URL_,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: JWT,
      SUPABASE_SERVICE_ROLE_KEY: service,
    });

    expect(c?.key).toBe(JWT);
    expect(c?.usingServiceRole).toBe(false);
  });

  it("falls back to a service-role key only when it is the only one", () => {
    const service = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2ln";
    const c = findSupabaseCredentials({
      SUPABASE_URL: URL_,
      SUPABASE_SERVICE_ROLE_KEY: service,
    });

    expect(c?.key).toBe(service);
    expect(c?.usingServiceRole).toBe(true);
  });

  it("trims a trailing slash off the URL", () => {
    const c = findSupabaseCredentials({
      SUPABASE_URL: `${URL_}/`,
      SUPABASE_ANON_KEY: JWT,
    });

    expect(c?.url).toBe(URL_);
  });

  it("ignores a Postgres connection string, which is not a REST URL", () => {
    const c = findSupabaseCredentials({
      POSTGRES_URL: "postgres://user:pw@db.abcdefgh.supabase.co:5432/postgres",
      SUPABASE_ANON_KEY: JWT,
    });

    expect(c).toBeNull();
  });

  it("returns null when only a URL or only a key is present", () => {
    expect(findSupabaseCredentials({ SUPABASE_URL: URL_ })).toBeNull();
    expect(findSupabaseCredentials({ SUPABASE_ANON_KEY: JWT })).toBeNull();
  });

  it("returns null for empty values, so a blank variable falls back to SQLite", () => {
    const c = findSupabaseCredentials({
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(c).toBeNull();
  });

  it("ignores a value that is not actually a key", () => {
    const c = findSupabaseCredentials({
      SUPABASE_URL: URL_,
      SUPABASE_ANON_KEY: "paste-your-key-here",
    });

    expect(c).toBeNull();
  });

  it("lists the Supabase-ish variable names for diagnostics", () => {
    const names = supabaseVarNames({
      NEXT_PUBLIC_SUPABASE_URL: URL_,
      POSTGRES_URL: "postgres://x",
      UNRELATED: "x",
    });

    expect(names).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "POSTGRES_URL"]);
  });
});
