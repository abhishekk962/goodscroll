import { preparePipeline } from "@/lib/content-pipeline"
import { generationInsights } from "@/lib/local-database"
import { OpenCodeRequestError } from "@/lib/opencode"

export const runtime = "nodejs"
export async function GET(request: Request) {
  try {
    const context = await preparePipeline(
      new URL(request.url).searchParams.get("project")
    )
    return Response.json(
      { ...generationInsights(context.scope), projectID: context.projectID },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof OpenCodeRequestError
            ? error.message
            : "Could not load generation insights.",
      },
      { status: error instanceof OpenCodeRequestError ? error.status : 500 }
    )
  }
}
