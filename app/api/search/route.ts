import { nimbleClient, publicWebURL } from "@/lib/web-search"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim()
  if (!query || query.length > 500)
    return Response.json(
      { error: "Enter a search of 1–500 characters." },
      { status: 400 }
    )
  try {
    const response = await nimbleClient().search(
      { query, search_depth: "lite", max_results: 10 },
      { signal: request.signal }
    )
    const results = response.results.flatMap((result) => {
      try {
        return [
          {
            url: publicWebURL(result.url),
            title: result.title,
            description: result.description,
          },
        ]
      } catch {
        return []
      }
    })
    return Response.json(
      { results },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return Response.json(
      {
        error: process.env.NIMBLE_API_KEY
          ? "Search could not load. Please try again."
          : "Search is unavailable. Set NIMBLE_API_KEY on the server.",
      },
      { status: 503 }
    )
  }
}
