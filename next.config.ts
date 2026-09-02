import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module used only for local development. Marking
  // it external keeps the bundler from trying to trace and bundle its binary,
  // which fails in a serverless build.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
