#!/usr/bin/env bun
// LeadOS — DB & env backup system
// Why: platform restarts can restore an EMPTY db/custom.db (happened 2026-09-18,
// wiped 278 leads + the user account). This script snapshots:
//   1. SQLite DB (consistent snapshot via VACUUM INTO)      -> db/backups/custom-*.db
//   2. .env + .env.local                                     -> db/backups/env-*.tar
//   3. JSON export of critical business tables (small, robust) -> db/backups/data-*.json
//   4. A rolling git snapshot commit of the latest DB copy
// Runs at server start (package.json "dev") and every 30 min via backup-loop.sh.
// Never throws — backup failure must not block the server.

import { Database } from "bun:sqlite"
import { mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync, existsSync, writeFileSync } from "fs"
import { join } from "path"

const ROOT = "/home/z/my-project"
const DB_PATH = join(ROOT, "db/custom.db")
const BACKUP_DIR = join(ROOT, "db/backups")
const MARKER = join(BACKUP_DIR, ".last-backup")
const MIN_INTERVAL_MS = 20 * 60 * 1000 // skip if backed up < 20 min ago (unless --force)
const KEEP_DB = 30
const KEEP_EXPORTS = 10

const force = process.argv.includes("--force")
const label = process.argv.includes("--startup") ? "startup" : "scheduled"

function log(msg: string) {
  console.log(`[backup ${new Date().toISOString()}] ${msg}`)
}

function safe<T>(fn: () => T, what: string): T | null {
  try {
    return fn()
  } catch (e) {
    log(`WARN ${what} failed: ${e}`)
    return null
  }
}

try {
  mkdirSync(BACKUP_DIR, { recursive: true })

  // --- RESTORE-FIRST (startup only): platform boots restore an EMPTY db ---
  // (repo.tar is git-based and the sqlite file is gitignored, so after every
  // sandbox reboot db/custom.db is recreated empty by `db:push`. If we detect
  // an empty system AND have a backup, restore it BEFORE the server starts.)
  if (process.argv.includes("--startup")) {
    safe(() => {
      const db = new Database(DB_PATH, { readonly: true })
      let empty = true