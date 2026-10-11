import { saveSelection, validOrigin } from "@/lib/browser-settings"
import { getOpenCodeProjects } from "@/lib/opencode"

export async function POST(request: Request) {
  if (!validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Choose a project." }, { status: 400 })
  }
  const projects = await getOpenCodeProjects()
  if (
    typeof body?.projectID !== "string" ||
    !projects.some((project) => project.id === body.projectID)
  ) {
    return Response.json(
      { error: "This project is unavailable. Refresh the project list." },
      { status: 400 }
    )
  }
  await saveSelection(body.projectID, request)
  return Response.json({ projectID: body.projectID })
}
