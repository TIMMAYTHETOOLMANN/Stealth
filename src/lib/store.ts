import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  Application,
  JobPosting,
  Profile,
  User,
} from "./types";

/**
 * Minimal, dependency-free JSON document store.
 *
 * This persists REAL application data (accounts, profiles, jobs, applications)
 * to disk under DATA_DIR. It is intentionally simple (single-process, file
 * locked via a serial write queue) so the project has zero native dependencies
 * and runs in any Node environment. Swap for Postgres/SQLite later without
 * touching callers.
 */

interface Database {
  users: User[];
  profiles: Profile[];
  jobs: JobPosting[];
  applications: Application[];
}

const EMPTY_DB: Database = {
  users: [],
  profiles: [],
  jobs: [],
  applications: [],
};

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Serialise writes to avoid interleaved read-modify-write races.
let writeChain: Promise<unknown> = Promise.resolve();

async function readDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return { ...EMPTY_DB, ...parsed };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(EMPTY_DB);
    }
    throw err;
  }
}

async function writeDb(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

/**
 * Atomically read-modify-write the database. Mutations are queued so concurrent
 * requests cannot clobber each other.
 */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  };
  const next = writeChain.then(run, run);
  // Keep the chain alive but swallow errors for the chain itself.
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Read-only query helper. */
export async function query<T>(fn: (db: Database) => T): Promise<T> {
  const db = await readDb();
  return fn(db);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}
