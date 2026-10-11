import { createHash } from "node:crypto"
import { cookies } from "next/headers"
import { cache } from "react"

export type ConnectionSettings = {
  baseUrl: string
  username: string
  password: string
  authenticated: boolean
  timeoutSeconds: number
}

export type ProjectSettings = { directory?: string; model?: string }
const CONNECTION_COOKIE = "goodscroll-connection"

export function defaultConnection(): ConnectionSettings {
  return {
    baseUrl: process.env.OPENCODE_SERVER_URL ?? "http://127.0.0.1:4096",
    username: "opencode",
    password: "",
    authenticated: false,
    timeoutSeconds: 10,
  }
}

function decode<T>(value?: string): T | undefined {
  try {
    return value
      ? (JSON.parse(Buffer.from(value, "base64url").toString()) as T)
      : undefined
  } catch {
    return undefined
  }
}

export const getConnectionSettings = cache(
  async (): Promise<ConnectionSettings> => {
    const saved = decode<ConnectionSettings>(
      (await cookies()).get(CONNECTION_COOKIE)?.value
    )
    return { ...defaultConnection(), ...saved }
  }
)

export function serverKey(baseUrl: string) {
  return createHash("sha256")
    .update(baseUrl.replace(/\/+$/, ""))
    .digest("hex")
    .slice(0, 20)
}

async function selectionKey() {
  return `goodscroll-active-${serverKey((await getConnectionSettings()).baseUrl)}`
}

async function projectKey(projectID: string) {
  const connection = await getConnectionSettings()
  return `goodscroll-project-${serverKey(connection.baseUrl)}-${createHash("sha256").update(projectID).digest("hex").slice(0, 20)}`
}

export async function selectedProjectID(query?: string | null) {
  if (query) return query
  const store = await cookies()
  const current = store.get(await selectionKey())?.value
  // Preserve the old selection only until this browser saves its connection.
  return (
    current ??
    (!store.has(CONNECTION_COOKIE)
      ? store.get("opencode-project")?.value
      : undefined)
  )
}

export const getProjectSettings = cache(
  async (projectID: string): Promise<ProjectSettings> => {
    const store = await cookies()
    const saved = decode<ProjectSettings>(
      store.get(await projectKey(projectID))?.value
    )
    if (saved) return saved
    // Migrate a working folder from the previous implementation on first save.
    return !store.has(CONNECTION_COOKIE) &&
      store.get("opencode-project")?.value === projectID
      ? { directory: store.get("opencode-directory")?.value }
      : {}
  }
)

function options(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  }
}

async function write(name: string, value: unknown, request: Request) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url")
  if (encoded.length > 3600)
    throw new Error("These settings are too large to save in this browser.")
  ;(await cookies()).set(name, encoded, options(request))
}

export async function saveConnection(
  settings: ConnectionSettings,
  request: Request
) {
  // Preserve the legacy active project's folder before changing connection.
  const store = await cookies()
  if (!store.has(CONNECTION_COOKIE)) {
    const activeProject = await selectedProjectID()
    const projectID = store.get("opencode-project")?.value
    if (projectID) {
      await saveProjectSettings(
        projectID,
        await getProjectSettings(projectID),
        request
      )
    }
    if (activeProject) await saveSelection(activeProject, request)
  }
  await write(CONNECTION_COOKIE, settings, request)
  for (const name of [
    "opencode-project",
    "opencode-directory",
    "opencode-global-directory",
  ]) {
    if (store.has(name)) store.delete(name)
  }
}

export async function saveSelection(projectID: string, request: Request) {
  ;(await cookies()).set(await selectionKey(), projectID, options(request))
}

export async function saveProjectSettings(
  projectID: string,
  settings: ProjectSettings,
  request: Request
) {
  await write(await projectKey(projectID), settings, request)
}

export function validOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const url = new URL(request.url)
  // Next's Node server can normalize request.url to its listening hostname.
  // The Host header retains the origin the browser actually connected to.
  const host = request.headers.get("host")
  try {
    return origin === new URL(`${url.protocol}//${host ?? url.host}`).origin
  } catch {
    return false
  }
}

export function validDirectory(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 2048 &&
    !value.includes("\0")
  )
}
