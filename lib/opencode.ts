import {
  createOpencodeClient,
  type Message,
  type Project,
  type Session,
  type SessionStatus,
  type Event as OpenCodeEvent,
  type Part,
} from "@opencode-ai/sdk"
import { posix, win32 } from "node:path"
import { cache } from "react"
import {
  getConnectionSettings,
  getProjectSettings,
  selectedProjectID,
  type ConnectionSettings,
} from "@/lib/browser-settings"
import { GLOBAL_PROJECT_ID } from "@/lib/project-profile"

export type OpenCodeProject = Project
export type OpenCodeStatus = SessionStatus["type"]

export { GLOBAL_PROJECT_ID } from "@/lib/project-profile"

export type OpenCodeMessage = {
  id: string
  sender: "friend" | "you"
  text: string
  time: string
  kind?: "summary"
  streaming?: boolean
}

export type OpenCodeConversation = {
  id: string
  model?: string
  friend: {
    id: string
    name: string
    username: string
    avatar: string
    initials: string
  }
  status: OpenCodeStatus
  unread: boolean
  messages: OpenCodeMessage[]
}

export function connectionClient(
  settings: ConnectionSettings,
  directory?: string
) {
  return createOpencodeClient({
    baseUrl: settings.baseUrl,
    directory,
    headers: settings.authenticated
      ? {
          Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString("base64")}`,
        }
      : undefined,
    fetch: async (input) => {
      const request = input instanceof Request ? input : new Request(input)
      // An event stream is long-lived; its caller owns cancellation.
      if (new URL(request.url).pathname.endsWith("/event"))
        return fetch(request)
      return fetch(request, {
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(settings.timeoutSeconds * 1000),
        ]),
      })
    },
  })
}

async function client(directory?: string) {
  return connectionClient(await getConnectionSettings(), directory)
}

export async function getOpenCodeDirectory(project?: Project) {
  if (project?.id === GLOBAL_PROJECT_ID) {
    return undefined
  }
  return project
    ? ((await getProjectSettings(project.id)).directory ?? project.worktree)
    : undefined
}

async function projectClient(project?: Project) {
  return client(await getOpenCodeDirectory(project))
}

export async function browseOpenCodeDirectory(directory?: string) {
  const scopedClient = await client(directory)
  const { data: location } = await scopedClient.path.get({ throwOnError: true })
  if (!location) throw new Error("Could not resolve folder")
  const { data: entries } = await scopedClient.file.list({
    query: { path: "" },
    throwOnError: true,
  })
  const paths = /^[A-Za-z]:[\\/]|^\\\\/.test(location.directory) ? win32 : posix
  const parent = paths.dirname(location.directory)
  return {
    directory: location.directory,
    parent: parent === location.directory ? null : parent,
    entries: (entries ?? []).sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === "directory"
          ? -1
          : 1
    ),
  }
}

export async function selectOpenCodeDirectory(directory: string) {
  // Listing first verifies that this is an existing, readable server folder.
  const location = await browseOpenCodeDirectory(directory)
  const { data: project } = await (
    await client(location.directory)
  ).project.current({
    throwOnError: true,
  })
  if (!project) throw new Error("Could not resolve project")
  return { directory: location.directory, project }
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OC"
  )
}

function projectName(session: Session, project?: Project) {
  if (session.projectID === GLOBAL_PROJECT_ID) return "Global"

  const directory = project?.worktree ?? session.directory
  return directory.split(/[\\/]/).filter(Boolean).at(-1) ?? "OpenCode"
}

function textFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text" && part.text?.trim())
    .map((part) => part.text?.trim())
    .join("\n\n")
}

function summaryText(message: Message) {
  if (message.role === "user" && message.summary) {
    return [message.summary.title, message.summary.body]
      .filter(Boolean)
      .join("\n\n")
  }
  return "OpenCode condensed earlier messages to preserve context."
}

function toConversation(
  session: Session,
  messages: Array<{
    info: Message
    parts: Array<{ type: string; text?: string }>
  }>,
  status: OpenCodeStatus,
  project?: Project
): OpenCodeConversation {
  const name = session.title || "Untitled session"
  const repository = projectName(session, project)
  const transcript = messages.flatMap(({ info, parts }) => {
    const text = textFromParts(parts)
    // User messages can include summary metadata after OpenCode compacts a
    // session. That metadata supplements the original prompt; it must not
    // replace a text part that is still available.
    const summary = !text && Boolean(info.summary)
    if (!text && !summary) return []

    return [
      {
        id: info.id,
        sender: (info.role === "user"
          ? "you"
          : "friend") as OpenCodeMessage["sender"],
        text: summary ? summaryText(info) : text,
        time: "",
        kind: summary ? ("summary" as const) : undefined,
        streaming: info.role === "assistant" && !info.time.completed,
      },
    ]
  })

  const lastMessage = messages.at(-1)?.info
  const model = lastMessage?.role === "user" ? lastMessage.model : lastMessage

  return {
    id: session.id,
    model: model ? `${model.providerID}/${model.modelID}` : undefined,
    friend: {
      id: session.id,
      name,
      username: repository,
      avatar: "",
      initials: initials(name),
    },
    status,
    unread: status !== "idle",
    messages: transcript,
  }
}

export const getOpenCodeProjectState = cache(async () => {
  try {
    const response = await (await client()).project.list({ throwOnError: true })
    return { projects: response.data ?? [], error: undefined }
  } catch {
    return {
      projects: [] as Project[],
      error:
        "Could not connect to OpenCode. Check your server URL and credentials in App settings.",
    }
  }
})

export async function getOpenCodeProjects() {
  return (await getOpenCodeProjectState()).projects
}

export async function getOpenCodeSelection(query?: string | null) {
  const state = await getOpenCodeProjectState()
  const projectID = await selectedProjectID(query)
  const project = projectID
    ? state.projects.find((item) => item.id === projectID)
    : state.projects[0]
  return {
    ...state,
    project,
    error:
      state.error ??
      (projectID && !project
        ? "This project is no longer available. Choose another project."
        : undefined),
  }
}

export const hasOpenCodeActivity = cache(async (projectID?: string) => {
  try {
    const { project } = await getOpenCodeSelection(projectID)
    if (!project) return false
    const scopedClient = await projectClient(project)
    const [sessions, statuses] = await Promise.all([
      scopedClient.session.list(),
      scopedClient.session.status(),
    ])
    return (sessions.data ?? []).some(
      (session) =>
        !session.parentID &&
        session.projectID === project.id &&
        !session.title.startsWith("[goodscroll agent]") &&
        !!statuses.data?.[session.id] &&
        statuses.data[session.id].type !== "idle"
    )
  } catch {
    return false
  }
})

export const getOpenCodeConversations = cache(async (projectID?: string) => {
  try {
    const { project } = await getOpenCodeSelection(projectID)
    if (!project) return []
    const selectedProjectID = project.id
    // Global chats always use the server default, independently of the selected
    // repository's folder.
    const scopedClient = await projectClient(project)
    const [sessionsResult, statusesResult] = await Promise.all([
      scopedClient.session.list(),
      scopedClient.session.status(),
    ])
    const rootSessions = (sessionsResult.data ?? []).filter(
      (session) =>
        !session.parentID &&
        session.projectID === selectedProjectID &&
        !session.title.startsWith("[goodscroll agent]")
    )
    const statuses = statusesResult.data ?? {}

    return await Promise.all(
      rootSessions.map(async (session) => {
        const result = await scopedClient.session.messages({
          path: { id: session.id },
        })
        return toConversation(
          session,
          result.data ?? [],
          statuses[session.id]?.type ?? "idle",
          project
        )
      })
    )
  } catch {
    return []
  }
})

export async function getOpenCodeConversation(id: string, projectID?: string) {
  const conversations = await getOpenCodeConversations(projectID)
  return conversations.find((conversation) => conversation.id === id)
}

export class OpenCodeRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export async function createOpenCodeConversation(projectID?: string) {
  const { project } = await getOpenCodeSelection(projectID)
  if (!project) throw new OpenCodeRequestError("Project not found.", 404)
  const scopedClient = await projectClient(project)
  const { data: session } = await scopedClient.session.create({
    body: { title: "New conversation" },
    throwOnError: true,
  })
  if (!session) throw new Error("Could not create conversation")
  return { id: session.id, project: project.id }
}

async function conversationClient(id: string, projectID?: string) {
  const { project } = await getOpenCodeSelection(projectID)
  if (!project) {
    throw new OpenCodeRequestError(
      "Project not found. Reopen the conversation.",
      404
    )
  }
  const scopedClient = await projectClient(project)
  const result = await scopedClient.session.get({ path: { id } })
  if (result.response.status === 404) {
    throw new OpenCodeRequestError("Conversation not found.", 404)
  }
  if (result.error || !result.data) throw new Error("Could not load session")
  if (result.data.projectID !== project.id || result.data.parentID) {
    throw new OpenCodeRequestError(
      "Conversation not found in this project.",
      404
    )
  }
  return {
    scopedClient: await client(result.data.directory),
    project,
    session: result.data,
  }
}

export async function readOpenCodeConversation(id: string, projectID?: string) {
  const { scopedClient, project, session } = await conversationClient(
    id,
    projectID
  )
  const [messages, statuses] = await Promise.all([
    scopedClient.session.messages({ path: { id }, throwOnError: true }),
    scopedClient.session.status({ throwOnError: true }),
  ])
  return toConversation(
    session,
    messages.data ?? [],
    statuses.data?.[id]?.type ?? "idle",
    project
  )
}

export async function sendOpenCodeMessage(
  id: string,
  text: string,
  projectID?: string,
  modelID?: string,
  messageID?: string
) {
  const { scopedClient, project } = await conversationClient(id, projectID)
  modelID ??= (await getProjectSettings(project.id)).model
  const separator = modelID?.indexOf("/") ?? -1
  const model =
    modelID && separator > 0
      ? {
          providerID: modelID.slice(0, separator),
          modelID: modelID.slice(separator + 1),
        }
      : undefined
  if (model) {
    const { data } = await scopedClient.provider.list({ throwOnError: true })
    const provider = data?.all.find((item) => item.id === model.providerID)
    if (
      !data?.connected.includes(model.providerID) ||
      !provider?.models[model.modelID]
    ) {
      throw new OpenCodeRequestError(
        "This model is unavailable. Select another model.",
        400
      )
    }
  }
  await scopedClient.session.promptAsync({
    path: { id },
    body: {
      messageID,
      parts: [{ type: "text", text }],
      ...(model ? { model } : {}),
    },
    throwOnError: true,
  })
}

export async function streamOpenCodeConversation(
  id: string,
  projectID: string | undefined,
  signal: AbortSignal
) {
  const { scopedClient, project, session } = await conversationClient(
    id,
    projectID
  )
  const abort = new AbortController()
  const stop = () => abort.abort()
  signal.addEventListener("abort", stop, { once: true })
  if (signal.aborted) stop()
  const events = await scopedClient.event.subscribe({ signal: abort.signal })
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let history: Array<{ info: Message; parts: Part[] }> | undefined
      let status: OpenCodeStatus = "idle"
      type StreamEvent =
        | OpenCodeEvent
        | {
            type: "message.part.delta"
            properties: {
              sessionID: string
              messageID: string
              partID: string
              field: string
              delta: string
            }
          }
      const queued: StreamEvent[] = []
      const close = () => {
        if (closed) return
        closed = true
        stop()
        clearTimeout(timer)
        clearInterval(heartbeat)
        signal.removeEventListener("abort", stop)
        try {
          controller.close()
        } catch {
          // The browser may have already cancelled the response body.
        }
      }
      abort.signal.addEventListener("abort", close, { once: true })
      function emit() {
        if (closed || !history) return
        const conversation = toConversation(session, history, status, project)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(conversation)}\n\n`)
        )
      }
      async function initialize() {
        try {
          const [messages, statuses] = await Promise.all([
            scopedClient.session.messages({
              path: { id },
              signal: abort.signal,
              throwOnError: true,
            }),
            scopedClient.session.status({
              signal: abort.signal,
              throwOnError: true,
            }),
          ])
          if (!closed) {
            history = messages.data ?? []
            status = statuses.data?.[id]?.type ?? "idle"
            for (const event of queued) apply(event)
            queued.length = 0
            emit()
          }
        } catch {
          close()
        }
      }
      function schedule() {
        if (timer || closed) return
        timer = setTimeout(() => {
          timer = undefined
          emit()
        }, 30)
      }
      function apply(event: StreamEvent) {
        if (!history) {
          queued.push(event)
          return
        }
        if (event.type === "message.updated") {
          const info = event.properties.info
          const existing = history.find(
            (message) => message.info.id === info.id
          )
          if (existing) existing.info = info
          else history.push({ info, parts: [] })
          history.sort((a, b) => a.info.id.localeCompare(b.info.id))
        } else if (event.type === "message.part.updated") {
          const part = event.properties.part
          const message = history.find(
            (message) => message.info.id === part.messageID
          )
          if (!message) return
          const index = message.parts.findIndex((item) => item.id === part.id)
          if (index >= 0) message.parts[index] = part
          else message.parts.push(part)
        } else if (event.type === "message.part.delta") {
          const { messageID, partID, field, delta } = event.properties
          const part = history
            .find((message) => message.info.id === messageID)
            ?.parts.find((part) => part.id === partID)
          if (part?.type === "text" && field === "text") part.text += delta
        } else if (event.type === "message.removed") {
          history = history.filter(
            (message) => message.info.id !== event.properties.messageID
          )
        } else if (event.type === "message.part.removed") {
          const message = history.find(
            (message) => message.info.id === event.properties.messageID
          )
          if (message)
            message.parts = message.parts.filter(
              (part) => part.id !== event.properties.partID
            )
        } else if (event.type === "session.status") {
          status = event.properties.status.type
        } else if (
          event.type === "session.idle" ||
          event.type === "session.error"
        ) {
          status = "idle"
        }
        schedule()
      }
      // Stored history can lag live tokens. Apply parts and deltas in memory
      // so the browser receives text as it is generated.
      void (async () => {
        try {
          for await (const incoming of events.stream) {
            const event = incoming as StreamEvent
            if (closed) break
            const properties = event.properties
            const sessionID =
              event.type === "message.part.updated"
                ? event.properties.part.sessionID
                : event.type === "message.updated"
                  ? event.properties.info.sessionID
                  : "sessionID" in properties
                    ? properties.sessionID
                    : undefined
            if (sessionID === id) apply(event)
          }
        } finally {
          close()
        }
      })().catch(close)
      void initialize()
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"))
      }, 15000)
      if (abort.signal.aborted) close()
    },
    cancel() {
      stop()
      clearTimeout(timer)
      clearInterval(heartbeat)
      signal.removeEventListener("abort", stop)
    },
  })
}

export type OpenCodeModel = { id: string; name: string; provider: string }

export async function getOpenCodeModels(
  projectID?: string
): Promise<OpenCodeModel[]> {
  try {
    const { project } = await getOpenCodeSelection(projectID)
    if (!project) return []
    const scopedClient = await projectClient(project)
    const { data } = await scopedClient.provider.list()
    return (data?.all ?? [])
      .filter((provider) => data?.connected.includes(provider.id))
      .flatMap((provider) =>
        Object.values(provider.models).map((model) => ({
          id: `${provider.id}/${model.id}`,
          name: model.name,
          provider: provider.name,
        }))
      )
      .sort(
        (a, b) =>
          a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)
      )
  } catch {
    return []
  }
}
