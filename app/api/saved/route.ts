import { validOrigin } from "@/lib/browser-settings"
import { preparePipeline } from "@/lib/content-pipeline"
import { savedContent, setContentSaved } from "@/lib/local-database"
import { OpenCodeRequestError } from "@/lib/opencode"

export const runtime = "nodejs"

async function handle(request: Request) {
  if (request.method !== "GET" && !validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  try {
    let body
    if (request.method === "PUT") {
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: "Invalid request." }, { status: 400 })
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        typeof body.id !== "string" ||
        !body.id ||
        body.id.length > 100 ||
        typeof body.saved !== "boolean"
      )
        return Response.json(
          { error: "Provide a content ID and save state." },
          { status: 400 }
        )
    }
    const { scope } = await preparePipeline(
      new URL(request.url).searchParams.get("project")
    )
    const result =
      request.method === "PUT"
        ? setContentSaved(scope, body.id, body.saved)
        : { items: savedContent(scope) }
    if (!result)
      return Response.json(
        { error: "Content not found in this project." },
        { status: 404 }
      )
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (!(error instanceof OpenCodeRequestError))
      console.error("Saved content failed", error)
    return Response.json(
      {
        error:
          error instanceof OpenCodeRequestError
            ? error.message
            : "Could not load or save content.",
      },
      { status: error instanceof OpenCodeRequestError ? error.status : 500 }
    )
  }
}
export const GET = handle
export const PUT = handle
