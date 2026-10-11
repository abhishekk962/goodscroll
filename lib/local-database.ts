import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { randomUUID, createHash } from "node:crypto"
import type { FeedContent, PostFeedback, Topic } from "./content-types"
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
  type GenerationRun,
  type GenerationRunData,
} from "./generation-types"

// Node 22.13+ supplies SQLite without a native npm dependency.
type Row = Record<string, string | number | null>
type Statement = {
  run(...values: (string | number | null)[]): { changes: number | bigint }
  all(...values: (string | number | null)[]): Row[]
  get(...values: (string | number | null)[]): Row | undefined
}
type Database = { exec(sql: string): void; prepare(sql: string): Statement }
let database: Database | undefined
export function db() {
  if (database) return database
  const path = resolve(
    /* turbopackIgnore: true */ process.env.GOODSCROLL_DB_PATH ??
      ".goodscroll/content.sqlite"
  )
  mkdirSync(dirname(path), { recursive: true })
  database = new DatabaseSync(path)
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY, scope TEXT NOT NULL, fingerprint TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL, sources TEXT NOT NULL,
      updated_at INTEGER NOT NULL, UNIQUE(scope, fingerprint));
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY, scope TEXT NOT NULL, topic_id TEXT NOT NULL REFERENCES topics(id),
      kind TEXT NOT NULL CHECK(kind IN ('post','reel')), title TEXT NOT NULL,
      body TEXT NOT NULL, slides TEXT NOT NULL, fingerprint TEXT NOT NULL,
      created_at INTEGER NOT NULL, seen_at INTEGER, UNIQUE(scope, fingerprint));
    CREATE INDEX IF NOT EXISTS content_feed ON content(scope, kind, seen_at, created_at);
    CREATE TABLE IF NOT EXISTS pipeline (
      scope TEXT PRIMARY KEY, lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
      retry_at INTEGER NOT NULL DEFAULT 0, checked_at INTEGER NOT NULL DEFAULT 0,
      transcript_hash TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS agent_sessions (id TEXT PRIMARY KEY, scope TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS post_likes (
      content_id TEXT PRIMARY KEY REFERENCES content(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
      body TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_content ON post_comments(content_id, created_at);
    CREATE TABLE IF NOT EXISTS saved_content (
      content_id TEXT PRIMARY KEY REFERENCES content(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_settings (id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation_runs (
      id TEXT PRIMARY KEY, scope TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER,
      status TEXT NOT NULL, stage TEXT NOT NULL, model TEXT, data TEXT NOT NULL, error TEXT);
    CREATE INDEX IF NOT EXISTS generation_runs_scope ON generation_runs(scope,started_at);`)
  return database
}
export function fingerprint(value: string) {
  return createHash("sha256")
    .update(value.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex")
}
export function getGenerationSettings(): GenerationSettings {
  const row = db()
    .prepare("SELECT settings FROM generation_settings WHERE id=1")
    .get()
  return row
    ? { ...DEFAULT_GENERATION_SETTINGS, ...JSON.parse(String(row.settings)) }
    : { ...DEFAULT_GENERATION_SETTINGS }
}
export function saveGenerationSettings(settings: GenerationSettings) {
  db()
    .prepare(
      "INSERT INTO generation_settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings"
    )
    .run(JSON.stringify(settings))
}
export function recordGenerationRun(
  scope: string,
  id: string,
  stage: string,
  model: string | null,
  data: GenerationRunData,
  status: "running" | "complete" | "failed" = "running",
  error: string | null = null
) {
  db()
    .prepare(
      `INSERT INTO generation_runs VALUES(?,?,?,NULL,?,?,?,?,?) ON CONFLICT(id)
    DO UPDATE SET finished_at=excluded.finished_at,status=excluded.status,stage=excluded.stage,model=excluded.model,data=excluded.data,error=excluded.error`
    )
    .run(
      id,
      scope,
      Date.now(),
      status,
      stage,
      model,
      JSON.stringify(data),
      error
    )
  if (status !== "running")
    db()
      .prepare("UPDATE generation_runs SET finished_at=? WHERE id=?")
      .run(Date.now(), id)
  db()
    .prepare(
      "DELETE FROM generation_runs WHERE scope=? AND id NOT IN (SELECT id FROM generation_runs WHERE scope=? ORDER BY started_at DESC,id DESC LIMIT 10)"
    )
    .run(scope, scope)
}
export function generationInsights(scope: string) {
  const state = pipelineState(scope)
  const runs: GenerationRun[] = db()
    .prepare(
      "SELECT * FROM generation_runs WHERE scope=? ORDER BY started_at DESC,id DESC LIMIT 10"
    )
    .all(scope)
    .map((row) => ({
      id: String(row.id),
      startedAt: Number(row.started_at),
      finishedAt: row.finished_at === null ? null : Number(row.finished_at),
      status:
        row.status === "running" &&
        (state?.lease !== row.id ||
          Number(state?.lease_until ?? 0) <= Date.now())
          ? "interrupted"
          : (row.status as GenerationRun["status"]),
      stage: String(row.stage),
      model: row.model === null ? null : String(row.model),
      error: row.error === null ? null : String(row.error),
      data: JSON.parse(String(row.data)),
    }))
  const stats = db()
    .prepare(
      `SELECT COUNT(*) AS total,
    SUM(CASE WHEN kind='post' THEN 1 ELSE 0 END) AS posts,
    SUM(CASE WHEN kind='reel' THEN 1 ELSE 0 END) AS reels,
    SUM(CASE WHEN seen_at IS NULL THEN 1 ELSE 0 END) AS unseen FROM content WHERE scope=?`
    )
    .get(scope)
  return {
    settings: getGenerationSettings(),
    runs,
    topics: topics(scope),
    feedback: generationFeedback(scope),
    stats: {
      posts: Number(stats?.posts ?? 0),
      reels: Number(stats?.reels ?? 0),
      unseen: Number(stats?.unseen ?? 0),
      topics: Number(
        db()
          .prepare("SELECT COUNT(*) AS count FROM topics WHERE scope=?")
          .get(scope)?.count ?? 0
      ),
      likes: Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM post_likes l JOIN content c ON c.id=l.content_id WHERE c.scope=?"
          )
          .get(scope)?.count ?? 0
      ),
      comments: Number(
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM post_comments p JOIN content c ON c.id=p.content_id WHERE c.scope=?"
          )
          .get(scope)?.count ?? 0
      ),
    },
    running: Number(state?.lease_until ?? 0) > Date.now(),
    checkedAt: Number(state?.checked_at ?? 0),
    retryAt: Number(state?.retry_at ?? 0),
    error: state?.error ? String(state.error) : null,
  }
}
export function topics(scope: string): Topic[] {
  return db()
    .prepare(
      "SELECT * FROM topics WHERE scope=? ORDER BY updated_at DESC LIMIT 40"
    )
    .all(scope)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      summary: String(row.summary),
      sources: JSON.parse(String(row.sources)),
    }))
}
function requireLease(scope: string, token: string) {
  const state = pipelineState(scope)
  if (state?.lease !== token || Number(state.lease_until) <= Date.now())
    throw new Error("Generation lease expired")
}
export function saveTopics(
  scope: string,
  values: Omit<Topic, "id">[],
  token: string
) {
  const statement = db()
    .prepare(`INSERT INTO topics VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope,fingerprint)
    DO UPDATE SET summary=excluded.summary, sources=excluded.sources, updated_at=excluded.updated_at`)
  db().exec("BEGIN IMMEDIATE")
  try {
    requireLease(scope, token)
    for (const topic of values)
      statement.run(
        randomUUID(),
        scope,
        fingerprint(topic.title),
        topic.title,
        topic.summary,
        JSON.stringify(topic.sources),
        Date.now()
      )
    db().exec("COMMIT")
  } catch (error) {
    db().exec("ROLLBACK")
    throw error
  }
}
export function content(scope: string, history = false): FeedContent[] {
  return db()
    .prepare(
      history
        ? "SELECT *, EXISTS(SELECT 1 FROM saved_content WHERE content_id=content.id) AS saved FROM content WHERE scope=? AND seen_at IS NOT NULL ORDER BY seen_at DESC, id LIMIT 20"
        : "SELECT *, EXISTS(SELECT 1 FROM saved_content WHERE content_id=content.id) AS saved FROM content WHERE scope=? AND seen_at IS NULL ORDER BY created_at, id LIMIT 100"
    )
    .all(scope)
    .map((row) => ({
      id: String(row.id),
      topicID: String(row.topic_id),
      kind: row.kind as FeedContent["kind"],
      title: String(row.title),
      body: String(row.body),
      slides: JSON.parse(String(row.slides)),
      seenAt: row.seen_at as number | null,
      saved: Boolean(row.saved),
    }))
}
export function savedContent(scope: string): FeedContent[] {
  return db()
    .prepare(
      "SELECT c.* FROM content c JOIN saved_content s ON s.content_id=c.id WHERE c.scope=? ORDER BY s.created_at DESC,c.id"
    )
    .all(scope)
    .map((row) => ({
      id: String(row.id),
      topicID: String(row.topic_id),
      kind: row.kind as FeedContent["kind"],
      title: String(row.title),
      body: String(row.body),
      slides: JSON.parse(String(row.slides)),
      seenAt: row.seen_at as number | null,
      saved: true,
    }))
}
export function setContentSaved(scope: string, id: string, saved: boolean) {
  if (
    !db()
      .prepare("SELECT id FROM content WHERE scope=? AND id=?")
      .get(scope, id)
  )
    return null
  if (saved)
    db()
      .prepare("INSERT OR IGNORE INTO saved_content VALUES(?,?)")
      .run(id, Date.now())
  else db().prepare("DELETE FROM saved_content WHERE content_id=?").run(id)
  return { saved }
}
export function postFeedback(scope: string, id: string): PostFeedback | null {
  if (
    !db()
      .prepare("SELECT id FROM content WHERE scope=? AND id=? AND kind='post'")
      .get(scope, id)
  )
    return null
  const rows = db()
    .prepare(
      "SELECT * FROM post_comments WHERE content_id=? ORDER BY created_at DESC, id DESC LIMIT 50"
    )
    .all(id)
  return {
    liked: Boolean(
      db()
        .prepare("SELECT content_id FROM post_likes WHERE content_id=?")
        .get(id)
    ),
    commentCount: Number(
      db()
        .prepare(
          "SELECT COUNT(*) AS count FROM post_comments WHERE content_id=?"
        )
        .get(id)?.count ?? 0
    ),
    comments: rows.reverse().map((row) => ({
      id: String(row.id),
      body: String(row.body),
      createdAt: Number(row.created_at),
    })),
  }
}
export function setPostLike(scope: string, id: string, liked: boolean) {
  if (!postFeedback(scope, id)) return null
  if (liked)
    db()
      .prepare("INSERT OR IGNORE INTO post_likes VALUES(?,?)")
      .run(id, Date.now())
  else db().prepare("DELETE FROM post_likes WHERE content_id=?").run(id)
  return postFeedback(scope, id)
}
export function addPostComment(
  scope: string,
  id: string,
  commentID: string,
  body: string
) {
  if (!postFeedback(scope, id)) return null
  const existing = db()
    .prepare("SELECT content_id,body FROM post_comments WHERE id=?")
    .get(commentID)
  if (existing && (existing.content_id !== id || existing.body !== body))
    throw new CommentConflictError()
  // Client-generated IDs make retries safe without collapsing intentional repeated comments.
  db()
    .prepare("INSERT OR IGNORE INTO post_comments VALUES(?,?,?,?)")
    .run(commentID, id, body, Date.now())
  return postFeedback(scope, id)
}
export class CommentConflictError extends Error {
  constructor() {
    super("This comment ID has already been used. Please submit a new comment.")
  }
}
export function generationFeedback(scope: string) {
  const posts = db()
    .prepare(
      `SELECT c.id,c.topic_id,c.title,c.body,l.created_at AS liked_at,
    MAX(COALESCE(l.created_at,0),COALESCE((SELECT MAX(created_at) FROM post_comments WHERE content_id=c.id),0)) AS interacted_at
    FROM content c LEFT JOIN post_likes l ON l.content_id=c.id
    WHERE c.scope=? AND c.kind='post' AND (l.content_id IS NOT NULL OR EXISTS(SELECT 1 FROM post_comments WHERE content_id=c.id))
    ORDER BY interacted_at DESC,c.id LIMIT 30`
    )
    .all(scope)
  return posts.map((post) => ({
    topicID: String(post.topic_id),
    title: String(post.title),
    excerpt: String(post.body).slice(0, 600),
    liked: post.liked_at !== null,
    comments: db()
      .prepare(
        "SELECT body FROM post_comments WHERE content_id=? ORDER BY created_at DESC,id DESC LIMIT 5"
      )
      .all(String(post.id))
      .reverse()
      .map((row) => String(row.body)),
  }))
}
export function saveContent(
  scope: string,
  items: Omit<FeedContent, "id" | "seenAt">[],
  token: string
) {
  const statement = db().prepare(
    "INSERT OR IGNORE INTO content VALUES(?,?,?,?,?,?,?,?,?,NULL)"
  )
  db().exec("BEGIN IMMEDIATE")
  try {
    requireLease(scope, token)
    let inserted = 0
    for (const item of items)
      inserted += Number(
        statement.run(
          randomUUID(),
          scope,
          item.topicID,
          item.kind,
          item.title,
          item.body,
          JSON.stringify(item.slides),
          fingerprint(`${item.kind} ${item.title} ${item.body}`),
          Date.now()
        ).changes
      )
    if (!inserted) throw new Error("The agent repeated existing content")
    db().exec("COMMIT")
  } catch (error) {
    db().exec("ROLLBACK")
    throw error
  }
}
export function markSeen(scope: string, id: string) {
  return (
    db()
      .prepare(
        "UPDATE content SET seen_at=COALESCE(seen_at,?) WHERE scope=? AND id=?"
      )
      .run(Date.now(), scope, id).changes > 0
  )
}
export function pipelineState(scope: string) {
  return db().prepare("SELECT * FROM pipeline WHERE scope=?").get(scope)
}
export function claimPipeline(scope: string) {
  db().prepare("INSERT OR IGNORE INTO pipeline(scope) VALUES(?)").run(scope)
  const token = randomUUID()
  const now = Date.now()
  const claimed = db()
    .prepare(
      "UPDATE pipeline SET lease=?,lease_until=?,error=NULL WHERE scope=? AND lease_until<? AND retry_at<=?"
    )
    .run(token, now + 600_000, scope, now, now)
  return claimed.changes ? token : null
}
export function finishPipeline(
  scope: string,
  token: string,
  hash: string | null,
  error: string | null
) {
  db()
    .prepare(
      "UPDATE pipeline SET lease=NULL,lease_until=0,retry_at=?,checked_at=?,transcript_hash=COALESCE(?,transcript_hash),error=? WHERE scope=? AND lease=?"
    )
    .run(
      Date.now() + (error ? 60_000 : 15_000),
      Date.now(),
      hash,
      error,
      scope,
      token
    )
}
