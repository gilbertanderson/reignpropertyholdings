#!/usr/bin/env node
// Push non-empty keys from .dev.vars to the Cloudflare Pages project.
//
// Prerequisites:
//   1. cp .dev.vars.example .dev.vars and fill in values
//   2. wrangler login   (or CLOUDFLARE_API_TOKEN in the environment)
//
// Usage:
//   node scripts/push-pages-secrets.mjs
//   node scripts/push-pages-secrets.mjs --dry-run
//   node scripts/push-pages-secrets.mjs --env preview

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "reignpropertyholdings";
const DEFAULT_FILE = ".dev.vars";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envFlagIndex = args.indexOf("--env");
const pagesEnv =
  envFlagIndex >= 0 ? args[envFlagIndex + 1] : "production";

if (pagesEnv !== "production" && pagesEnv !== "preview") {
  console.error("Use --env production or --env preview");
  process.exit(1);
}

const fileArg = args.find((arg) => !arg.startsWith("--") && arg !== pagesEnv);
const source = fileArg || DEFAULT_FILE;

if (!existsSync(source)) {
  console.error(`Missing ${source}. Copy .dev.vars.example and fill in values.`);
  process.exit(1);
}

const entries = parseDevVars(readFileSync(source, "utf8"));
const keys = Object.keys(entries);

if (!keys.length) {
  console.error(`No non-empty variables found in ${source}.`);
  process.exit(1);
}

console.log(
  `${dryRun ? "[dry-run] Would upload" : "Uploading"} ${keys.length} secret(s) to Pages project "${PROJECT}" (${pagesEnv}):`
);
for (const key of keys) console.log(`  - ${key}`);

if (dryRun) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), "pages-secrets-"));
const bulkFile = join(dir, "bulk.dev.vars");
writeFileSync(
  bulkFile,
  keys.map((key) => `${key}=${entries[key]}`).join("\n") + "\n"
);

const wranglerArgs = [
  "wrangler",
  "pages",
  "secret",
  "bulk",
  bulkFile,
  "--project-name",
  PROJECT,
];

if (pagesEnv === "preview") {
  wranglerArgs.push("--env", "preview");
}

const result = spawnSync("npx", wranglerArgs, {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);

function parseDevVars(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}
