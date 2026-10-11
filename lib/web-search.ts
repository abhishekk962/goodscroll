import "server-only"
import Nimble from "@nimble-way/nimble-js"
import { db } from "@/lib/local-database"
export { publicWebURL } from "@/lib/web-url"

export function nimbleClient() {
  if (!process.env.NIMBLE_API_KEY)
    throw new Error("Set NIMBLE_API_KEY on the server.")
  return new Nimble({ timeout: 60000, maxRetries: 0 })
}

function visitsDB() {
  const database = db()
  database.exec(`CREATE TABLE IF NOT EXISTS web_visits (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
    visited_at INTEGER NOT NULL, screenshot TEXT, markdown TEXT, UNIQUE(owner,url));
    CREATE INDEX IF NOT EXISTS web_visits_recent ON web_visits(owner,visited_at DESC);`)
  return database
}

export function recentVisits(owner: string) {
  return visitsDB()
    .prepare(
      "SELECT id,url,title,visited_at,screenshot IS NOT NULL AS has_snapshot FROM web_visits WHERE owner=? ORDER BY visited_at DESC LIMIT 50"
    )
    .all(owner)
    .map((row) => ({
      id: String(row.id),
      url: String(row.url),
      title: String(row.title),
      visitedAt: Number(row.visited_at),
      hasSnapshot: Boolean(row.has_snapshot),
    }))
}

export function recordVisit(owner: string, url: string, title: string) {
  const database = visitsDB()
  database
    .prepare(
      `INSERT INTO web_visits(id,owner,url,title,visited_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner,url) DO UPDATE SET title=excluded.title,visited_at=excluded.visited_at`
    )
    .run(crypto.randomUUID(), owner, url, title, Date.now())
  database
    .prepare(
      "DELETE FROM web_visits WHERE owner=? AND id NOT IN (SELECT id FROM web_visits WHERE owner=? ORDER BY visited_at DESC LIMIT 50)"
    )
    .run(owner, owner)
  return database
    .prepare("SELECT * FROM web_visits WHERE owner=? AND url=?")
    .get(owner, url)!
}

export function visitByID(owner: string, id: string) {
  return visitsDB()
    .prepare("SELECT * FROM web_visits WHERE owner=? AND id=?")
    .get(owner, id)
}

export function saveSnapshot(
  owner: string,
  id: string,
  screenshot: string | null,
  markdown: string
) {
  visitsDB()
    .prepare(
      "UPDATE web_visits SET screenshot=COALESCE(?,screenshot),markdown=? WHERE owner=? AND id=?"
    )
    .run(screenshot, markdown.slice(0, 500000), owner, id)
}

export function pngSnapshot(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.replace(/^data:image\/png;base64,/, "")
  if (raw.length > 16000000 || !/^[A-Za-z0-9+/=\s]+$/.test(raw)) return null
  const bytes = Buffer.from(raw, "base64")
  return bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? bytes.toString("base64")
    : null
}
