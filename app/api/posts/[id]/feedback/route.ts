import { validOrigin } from "@/lib/browser-settings"
import { preparePipeline } from "@/lib/content-pipeline"
import {
  addPostComment,
  CommentConflictError,
  postFeedback,
  setPostLike,
} from "@/lib/local-database"
import { OpenCodeRequestError } from "@/lib/opencode"

export const runtime = "nodejs"
type Context = { params: Promise<{ id: string }> }

async function handle(request: Request, context: Context) {
  if (request.method !== "GET" && !validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  try {
    const { id } = await context.params
    if (!id || id.length > 100)
      return Response.json({ error: "Invalid post ID." }, { status: 400 })
    let body
    if (request.method !== "GET") {
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: "Invalid request." }, { status: 400 })
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        (request.method === "PUT" && typeof body.liked !== "boolean") ||
        (request.method === "POST" &&
          (typeof body.body !== "string" ||
            !body.body.trim() ||
            body.body.length > 1000 ||
            typeof body.id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              body.id
            )))
      )
        return Response.json(
          {
            error:
              "Provide a like state or a comment of 1–1000 characters with a valid ID.",
          },
          { status: 400 }
        )
    }
    const { scope } = await preparePipeline(
      new URL(request.url).searchParams.get("project")
    )
    const feedback =
      request.method === "PUT"
        ? setPostLike(scope, id, body.liked)
        : request.method === "POST"
          ? addPostComment(scope, id, body.id, body.body.trim())
          : postFeedback(scope, id)
    if (!feedback)
      return Response.json(
        { error: "Post not found in this project." },
        { status: 404 }
      )
    return Response.json(feedback, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CommentConflictError)
      return Response.json({ error: error.message }, { status: 409 })
    if (!(error instanceof OpenCodeRequestError))
      console.error("Post feedback failed", error)
    return Response.json(
      {
        error:
          error instanceof OpenCodeRequestError
            ? error.message
            : "Could not save or load post feedback.",
      },
      { status: error instanceof OpenCodeRequestError ? error.status : 500 }
    )
  }
}
export const GET = handle
export const PUT = handle
export const POST = handle
