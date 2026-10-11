import { after } from "next/server"
import { validOrigin } from "@/lib/browser-settings"
import {
  preparePipeline,
  readFeed,
  schedulePipeline,
} from "@/lib/content-pipeline"
import { markSeen } from "@/lib/local-database"
import { OpenCodeRequestError } from "@/lib/opencode"

export const runtime = "nodejs"
export const maxDuration = 600
export async function GET(request: Request) {
  try {
    const context = await preparePipeline(
      new URL(request.url).searchParams.get("project")
    )
    return Response.json(
      { ...readFeed(context.scope), projectID: context.projectID },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request: Request) {
  if (!validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: "Invalid request." }, { status: 400 })
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      (body.seenID !== undefined &&
        (typeof body.seenID !== "string" ||
          !body.seenID ||
          body.seenID.length > 100))
    )
      return Response.json({ error: "Invalid content ID." }, { status: 400 })
    const context = await preparePipeline(
      new URL(request.url).searchParams.get("project")
    )
    if (body.seenID && !markSeen(context.scope, body.seenID))
      return Response.json(
        { error: "Content not found in this project." },
        { status: 404 }
      )
    const work = schedulePipeline(context)
    if (work) after(work)
    return Response.json({
      ...readFeed(context.scope),
      projectID: context.projectID,
    })
  } catch (error) {
    return failure(error)
  }
}
function failure(error: unknown) {
  if (!(error instanceof OpenCodeRequestError))
    console.error(
      "Goodscroll feed failed",
      error instanceof Error ? error.message : "Unknown error"
    )
  return Response.json(
    {
      error:
        error instanceof OpenCodeRequestError
          ? error.message
          : "Could not load project content.",
    },
    { status: error instanceof OpenCodeRequestError ? error.status : 500 }
  )
}
