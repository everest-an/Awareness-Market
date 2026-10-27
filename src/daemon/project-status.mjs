/**
 * Each project publishes its own progress into the shared registry.
 *
 * The alternative -- having the console open every other project's SQLite file --
 * works but is backwards: it makes one process responsible for reading databases
 * it does not own, and it breaks the moment a project lives on a drive that is
 * not mounted. A daemon already knows the state of the workspace it serves, so it
 * writes that state down where every other reader can see it.
 *
 * Location: $AWARENESS_HOME/.awareness/project-status.json  (default ~/.awareness)
 * Shape:   { "<projectDir>": { name, tasks:{open,doing,done}, memories, updatedAt } }
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const PROJECT_STATUS_FILE = 'project-status.json';

export function projectStatusPath() {
  const home = process.env.AWARENESS_HOME || os.homedir();
  return path.join(home, '.awareness', PROJECT_STATUS_FILE);
}

export function readProjectStatus() {
  try {
    const file = projectStatusPath();
    if (!fs.existsSync(file)) return {};
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function writeProjectStatus(projectDir, stats) {
  try {
    const file = projectStatusPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const current = readProjectStatus();
    current[projectDir] = {
      name: path.basename(projectDir),
      tasks: stats.tasks || { open: null, doing: null, done: null },
      memories: stats.memories ?? null,
      updatedAt: new Date().toISOString(),
    };
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export function collectLocalStats(indexer) {
  if (!indexer?.db) return { tasks: { open: null, doing: null, done: null }, memories: null };
  const one = (sql) => {
    try { return indexer.db.prepare(sql).get().c; } catch { return null; }
  };
  return {
    tasks: {
      open: one("SELECT COUNT(*) AS c FROM tasks WHERE status='open'"),
      doing: one("SELECT COUNT(*) AS c FROM tasks WHERE status IN ('claimed','doing')"),
      done: one("SELECT COUNT(*) AS c FROM tasks WHERE status='done'"),
    },
    memories: one("SELECT COUNT(*) AS c FROM memories WHERE status='active'"),
  };
}