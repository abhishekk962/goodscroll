import { selectedProjectID } from "@/lib/browser-settings"
import {
  OpenCodeRequestError,
  readOpenCodeConversation,
  sendOpenCodeMessage,
  streamOpenCodeConversation,
} from "@/lib/opencode"

type Context = { params: Promise<{ id: string }> }

async function selection(request: Request) {
  return selectedProjectID(new URL(request.url).searchParams.get("project"))
}

function failure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof OpenCodeRequestError
          ? error.message
          : "Could not connect to OpenCode. Please try again.",
    },
    { status: error instanceof OpenCodeRequestError ? error.status : 502 }
  )
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params
    if (new URL(request.url).searchParams.get("stream") === "1") {
      return new Response(
        await streamOpenCodeConversation(
          id,
          await selection(request),
          request.signal
        ),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        }
      )
    }
    return Response.json(
      await readOpenCodeConversation(id, await selection(request)),
      {
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid message." }, { status: 400 })
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("text" in body) ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > 32000 ||
    ("messageID" in body &&
      (typeof body.messageID !== "string" ||
        !/^msg_[a-zA-Z0-9]{20,64}$/.test(body.messageID))) ||
    ("model" in body &&
      body.model !== undefined &&
      (typeof body.model !== "string" || !/^[^/]+\/.+$/.test(body.model)))
  ) {
    return Response.json(
      {
        error: "Enter a message of up to 32,000 characters and a valid model.",
      },
      { status: 400 }
    )
  }
  try {
    const { id } = await params
    await sendOpenCodeMessage(
      id,
      body.text.trim(),
      await selection(request),
      "model" in body ? (body.model as string | undefined) : undefined,
      "messageID" in body ? (body.messageID as string) : undefined
    )
    return Response.json({ accepted: true }, { status: 202 })
  } catch (error) {
    return failure(error)
  }
}
