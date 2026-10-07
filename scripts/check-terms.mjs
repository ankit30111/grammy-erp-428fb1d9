#!/usr/bin/env node
// One word for one thing. Fails when a screen spells a standard term another way.
//   Sub-assembly   not "Sub Assembly", "Sub-Assembly", "sub assy", "Sub-assemblies"
// Code names (SubAssembly, sub_assembly, SUBASSEMBLY_RECEIPT) are not words on a
// screen and are not checked. Comments are skipped. A line that has to compare
// with an old stored value can end with `// terms-ok`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["sub-assembly", "Sub-assembly", "SUB-ASSEMBLY"]);
const WORD = /sub[ \-]+(?:assembl(?:y|ies)|assy)/gi;
const skip = (p) => p.includes("integrations/supabase/types.ts");

const files = [];
const walk = (d) => readdirSync(d).forEach((n) => {
  const p = join(d, n);
  if (statSync(p).isDirectory()) walk(p);
  else if (/\.(tsx?|jsx?)$/.test(n) && !skip(p)) files.push(p);
});
walk("src");

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  src.split("\n").forEach((line, i) => {
    if (/\/\/\s*terms-ok/.test(line)) return;
    const code = line.replace(/(^|[^:])\/\/.*$/, "$1");
    for (const m of code.matchAll(WORD)) {
      if (!ALLOWED.has(m[0])) { bad++; console.log(`${f}:${i + 1}  "${m[0]}"  -> write "Sub-assembly"`); }
    }
  });
}
if (bad) { console.log(`\n${bad} non-standard spelling(s). Standard: "Sub-assembly" (one word on every screen, no plural label).`); process.exit(1); }
console.log("Terms OK");
