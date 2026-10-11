import { selectedProjectID } from "@/lib/browser-settings"
import {
  createOpenCodeConversation,
  OpenCodeRequestError,
} from "@/lib/opencode"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  }
  try {
    const project = await selectedProjectID(
      new URL(request.url).searchParams.get("project")
    )
    return Response.json(await createOpenCodeConversation(project), {
      status: 201,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof OpenCodeRequestError
            ? error.message
            : "Could not start a conversation. Please try again.",
      },
      { status: error instanceof OpenCodeRequestError ? error.status : 502 }
    )
  }
}
