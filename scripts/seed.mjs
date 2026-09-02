// Seeds plausible practice history so the dashboard can be checked with real
// shapes. Usage: node scripts/seed.mjs [days]
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const days = Number(process.argv[2] ?? 21);
const db = new Database("db/practice.db");
db.exec(readFileSync("db/migrations/001_init.sql", "utf8"));
db.exec("DELETE FROM attempts; DELETE FROM sessions;");

const { MODULES } = await import("../lib/vocab.ts");
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const insS = db.prepare(
  `INSERT INTO sessions (id,user_id,kind,scope,direction,started_at) VALUES (?,?,?,?,?,?)`
);
const insA = db.prepare(
  `INSERT INTO attempts (id,session_id,user_id,asked_at,kind,scope,word_key,direction,
    prompt,expected,given,status,error_kind,ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

// Some modules are deliberately weak so "weakest first" has something to show.
const weak = new Set(["B3", "D1", "B9"]);
let attempts = 0;

for (let d = days - 1; d >= 0; d--) {
  if (Math.random() < 0.2) continue;            // a rest day
  const date = new Date();
  date.setDate(date.getDate() - d);

  for (let s = 0; s < 1 + Math.floor(Math.random() * 2); s++) {
    const mod = pick(MODULES);
    const sid = randomUUID();
    const when = new Date(date);
    when.setHours(9 + Math.floor(Math.random() * 12));
    insS.run(sid, "local", "vocab", mod.id, "en-fr", when.toISOString());

    const n = 10 + Math.floor(Math.random() * 20);
    for (let i = 0; i < n; i++) {
      const w = pick(mod.words);
      const base = weak.has(mod.id) ? 0.45 : 0.78;
      const roll = Math.random();
      let status = "correct", errorKind = null, given = w.fr;

      if (roll > base) {
        const e = Math.random();
        if (e < 0.3) { status = "accent"; errorKind = "accent"; given = w.fr.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
        else if (e < 0.5) { status = "wrong"; errorKind = "article"; given = w.fr.replace(/^le /, "la "); }
        else if (e < 0.85) { status = "wrong"; errorKind = "unknown"; given = "???"; }
        else { status = "wrong"; errorKind = "skipped"; given = ""; }
      }

      const at = new Date(when);
      at.setMinutes(at.getMinutes() + i);
      insA.run(randomUUID(), sid, "local", at.toISOString(), "vocab", mod.id,
        `${mod.id}|${w.fr}`, "en-fr", w.en, w.fr, given, status, errorKind,
        800 + Math.floor(Math.random() * 4000));
      attempts++;
    }
  }
}

console.log(`seeded ${attempts} attempts across ${days} days`);
db.close();
