import {
  getProjectSettings,
  saveProjectSettings,
  saveSelection,
  validDirectory,
  validOrigin,
} from "@/lib/browser-settings"
import {
  GLOBAL_PROJECT_ID,
  browseOpenCodeDirectory,
  selectOpenCodeDirectory,
  getOpenCodeProjects,
} from "@/lib/opencode"

function failure() {
  return Response.json(
    {
      error:
        "Could not open this folder. Check the path and OpenCode connection.",
    },
    { status: 502 }
  )
}

export async function GET(request: Request) {
  const directory = new URL(request.url).searchParams.get("directory")
  if (directory !== null && !validDirectory(directory)) {
    return Response.json(
      { error: "Enter a valid folder path." },
      { status: 400 }
    )
  }
  try {
    return Response.json(
      await browseOpenCodeDirectory(directory ?? undefined),
      {
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch {
    return failure()
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: "Enter a valid folder path." },
      { status: 400 }
    )
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("directory" in body) ||
    !validDirectory(body.directory) ||
    !("action" in body) ||
    (body.action !== "add" && body.action !== "folder")
  ) {
    return Response.json(
      { error: "Enter a valid folder path." },
      { status: 400 }
    )
  }
  if (
    body.action === "folder" &&
    (!("projectID" in body) ||
      typeof body.projectID !== "string" ||
      body.projectID === GLOBAL_PROJECT_ID ||
      !(await getOpenCodeProjects()).some(
        (project) => project.id === body.projectID
      ))
  ) {
    return Response.json(
      { error: "Choose a repository project first." },
      { status: 400 }
    )
  }
  try {
    const result = await selectOpenCodeDirectory(body.directory)
    if (result.project.id === GLOBAL_PROJECT_ID) {
      return Response.json(
        {
          error:
            "Choose a repository project. The Global folder cannot be changed.",
        },
        { status: 403 }
      )
    }
    if (
      body.action === "folder" &&
      "projectID" in body &&
      result.project.id !== body.projectID
    ) {
      return Response.json(
        {
          error:
            "This folder belongs to a different project. Use Add project to open it.",
        },
        { status: 400 }
      )
    }
    const projectID = result.project.id
    await saveProjectSettings(
      projectID,
      { ...(await getProjectSettings(projectID)), directory: result.directory },
      request
    )
    if (body.action === "add") await saveSelection(projectID, request)
    return Response.json({
      directory: result.directory,
      projectID,
    })
  } catch {
    return failure()
  }
}
