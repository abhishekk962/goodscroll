import { cookies } from "next/headers"
import { validOrigin } from "@/lib/browser-settings"
import {
  nimbleClient,
  pngSnapshot,
  publicWebURL,
  recentVisits,
  recordVisit,
  saveSnapshot,
  visitByID,
} from "@/lib/web-search"

export const runtime = "nodejs"
const cookieName = "goodscroll-browser"
async function owner() {
  const jar = await cookies()
  let value = jar.get(cookieName)?.value
  if (!value || !/^[0-9a-f-]{36}$/.test(value)) {
    value = crypto.randomUUID()
    jar.set(cookieName, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 31536000,
    })
  }
  return value
}

export async function GET(request: Request) {
  const user = await owner()
  const params = new URL(request.url).searchParams
  const id = params.get("snapshot")
  if (id) {
    const visit = visitByID(user, id)
    if (!visit?.screenshot) return new Response(null, { status: 404 })
    return new Response(Buffer.from(String(visit.screenshot), "base64"), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }
  return Response.json(
    { visits: recentVisits(user) },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  if (!validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  let body
  let url
  try {
    body = await request.json()
    url = publicWebURL(body.url)
  } catch {
    return Response.json(
      { error: "Enter a public HTTP or HTTPS website URL." },
      { status: 400 }
    )
  }
  const user = await owner()
  const title =
    typeof body.title === "string"
      ? body.title.slice(0, 300)
      : new URL(url).hostname
  const suppliedSnapshot =
    body.screenshot === undefined ? null : pngSnapshot(body.screenshot)
  if (body.screenshot !== undefined && !suppliedSnapshot)
    return Response.json({ error: "Invalid PNG snapshot." }, { status: 400 })
  const visit = recordVisit(user, url, title)
  if (suppliedSnapshot)
    saveSnapshot(
      user,
      String(visit.id),
      suppliedSnapshot,
      String(visit.markdown ?? "")
    )
  let snapshotError: string | null = null
  if (
    !suppliedSnapshot &&
    body.recordOnly !== true &&
    (!visit.screenshot || !visit.markdown || body.refresh === true)
  ) {
    try {
      const result = await nimbleClient().extract.run({
        url,
        render: true,
        formats: visit.screenshot ? ["markdown"] : ["screenshot", "markdown"],
      })
      if (result.status !== "success") throw new Error("Extraction failed")
      const screenshot = pngSnapshot(result.data?.screenshots?.[0])
      saveSnapshot(
        user,
        String(visit.id),
        screenshot,
        result.data?.markdown ?? ""
      )
      if (!screenshot && !visit.screenshot)
        snapshotError =
          "A page preview could not be captured. You can still browse the site."
    } catch {
      snapshotError =
        "The page preview and reader could not be refreshed. You can still browse the site."
    }
  }
  const saved = visitByID(user, String(visit.id))
  return Response.json(
    {
      visits: recentVisits(user),
      markdown: saved?.markdown ?? "",
      snapshotError,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
