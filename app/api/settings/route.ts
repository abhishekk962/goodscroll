import {
  defaultConnection,
  getConnectionSettings,
  getProjectSettings,
  saveConnection,
  saveProjectSettings,
  validOrigin,
  type ConnectionSettings,
} from "@/lib/browser-settings"
import {
  connectionClient,
  getOpenCodeModels,
  getOpenCodeProjects,
} from "@/lib/opencode"

function invalid(message: string) {
  return Response.json({ error: message }, { status: 400 })
}

async function connection(
  body: Record<string, unknown>
): Promise<ConnectionSettings> {
  if (body.reset === true) return defaultConnection()
  if (typeof body.baseUrl !== "string" || body.baseUrl.length > 1024)
    throw new Error("Enter a valid HTTP or HTTPS server URL.")
  let url: URL
  try {
    url = new URL(body.baseUrl.trim())
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS server URL.")
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use an HTTP or HTTPS URL without credentials, query parameters, or a fragment."
    )
  }
  if (
    typeof body.authenticated !== "boolean" ||
    typeof body.username !== "string" ||
    body.username.length > 128 ||
    /[:\r\n]/.test(body.username)
  )
    throw new Error("Enter a valid username.")
  if (
    body.password !== undefined &&
    (typeof body.password !== "string" || body.password.length > 512)
  )
    throw new Error("Password must be at most 512 characters.")
  if (
    typeof body.timeoutSeconds !== "number" ||
    !Number.isInteger(body.timeoutSeconds) ||
    body.timeoutSeconds < 1 ||
    body.timeoutSeconds > 60
  )
    throw new Error("Choose a timeout between 1 and 60 seconds.")
  const saved = await getConnectionSettings()
  const baseUrl = url.toString().replace(/\/+$/, "")
  const username = body.username.trim() || "opencode"
  const canKeepPassword =
    baseUrl === saved.baseUrl.replace(/\/+$/, "") && username === saved.username
  const password = body.authenticated
    ? ((body.password as string | undefined) ??
      (canKeepPassword ? saved.password : ""))
    : ""
  if (body.authenticated && !password)
    throw new Error(
      "Enter the server password. Saved credentials can only be reused for the same URL and username."
    )
  return {
    baseUrl,
    authenticated: body.authenticated,
    username,
    password,
    timeoutSeconds: body.timeoutSeconds,
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  let body
  try {
    body = await request.json()
  } catch {
    return invalid("Invalid settings.")
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return invalid("Invalid settings.")
  if (body.scope === "app") {
    let settings
    try {
      settings = await connection(body)
    } catch (error) {
      return invalid(
        error instanceof Error ? error.message : "Invalid settings."
      )
    }
    if (body.action === "test") {
      try {
        const { data } = await connectionClient(settings).project.list({
          throwOnError: true,
        })
        if (!Array.isArray(data)) throw new Error("Invalid server response")
        return Response.json({
          message: `Connected. ${data.length} project${data.length === 1 ? "" : "s"} available.`,
        })
      } catch {
        return Response.json(
          {
            error:
              "Connection failed. Check the URL, credentials, and whether the server is running. The URL must be reachable from Goodscroll.",
          },
          { status: 502 }
        )
      }
    }
    if (body.action !== "save")
      return invalid("Choose Save or Test connection.")
    await saveConnection(settings, request)
    return Response.json({ message: "App settings saved in this browser." })
  }
  if (body.scope === "project") {
    const projects = await getOpenCodeProjects()
    if (
      typeof body.projectID !== "string" ||
      !projects.some((project) => project.id === body.projectID)
    )
      return invalid("Choose an available project.")
    if (
      body.model !== null &&
      (typeof body.model !== "string" ||
        !(await getOpenCodeModels(body.projectID)).some(
          (model) => model.id === body.model
        ))
    )
      return invalid("Choose an available model or OpenCode default.")
    const settings = await getProjectSettings(body.projectID)
    await saveProjectSettings(
      body.projectID,
      { ...settings, model: body.model ?? undefined },
      request
    )
    return Response.json({ message: "Project default saved in this browser." })
  }
  return invalid("Choose app or project settings.")
}
