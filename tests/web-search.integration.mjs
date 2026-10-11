// Run after pnpm build. Isolated Nimble fixture + Next server; no paid API calls.
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
let extractions = 0
const mock = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, "Bearer fixture-key")
  let raw = ""
  for await (const part of request) raw += part
  const body = JSON.parse(raw)
  response.setHeader("Content-Type", "application/json")
  if (request.url === "/v2/search") {
    assert.equal(body.search_depth, "lite")
    if (body.query === "fail") {
      response.statusCode = 503
      return response.end("{}")
    }
    return response.end(
      JSON.stringify({
        request_id: "test",
        total_results: 2,
        results: [
          {
            title: "Example page",
            url: "https://example.com/",
            description: "A useful page",
            content: "",
            metadata: {},
          },
          {
            title: "Unsafe",
            url: "javascript:alert(1)",
            description: "",
            content: "",
            metadata: {},
          },
        ],
      })
    )
  }
  if (request.url === "/v2/extract") {
    extractions++
    assert.ok(body.formats.includes("markdown"))
    assert.equal(body.render, true)
    if (body.url.includes("failure")) {
      response.statusCode = 503
      return response.end("{}")
    }
    return response.end(
      JSON.stringify({
        status: "success",
        data: {
          screenshots: [png],
          markdown: "# Example\nReadable web content",
        },
      })
    )
  }
  response.statusCode = 404
  response.end("{}")
})
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve))
const directory = await mkdtemp(join(tmpdir(), "goodscroll-web-test-"))
const app = "http://localhost:3101"
let output = ""
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3101"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NIMBLE_API_KEY: "fixture-key",
      NIMBLE_BASE_URL: `http://127.0.0.1:${mock.address().port}`,
      GOODSCROLL_DB_PATH: join(directory, "test.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
)
child.stdout.on("data", (part) => {
  output += part
})
child.stderr.on("data", (part) => {
  output += part
})

function browser() {
  let cookie = ""
  return async (path, body, expected = 200, origin = app) => {
    const response = await fetch(`${app}${path}`, {
      headers: {
        Cookie: cookie,
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
      },
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.headers.getSetCookie().length)
      cookie = response.headers.getSetCookie()[0].split(";")[0]
    assert.equal(
      response.status,
      expected,
      `${path}: ${await response.clone().text()}`
    )
    return response
  }
}
try {
  let ready = false
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error(output)
    try {
      await fetch(`${app}/api/search?q=`)
      ready = true
      break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, output)
  const first = browser(),
    second = browser()
  const found = await (await first("/api/search?q=example")).json()
  assert.equal(found.results.length, 1)
  assert.equal(found.results[0].url, "https://example.com/")
  await first("/api/search?q=fail", undefined, 503)
  await first("/api/search?q=", undefined, 400)
  assert.deepEqual((await (await first("/api/browser")).json()).visits, [])
  const visit = await (
    await first("/api/browser", {
      url: "https://example.com/",
      title: "Example page",
    })
  ).json()
  assert.equal(visit.visits.length, 1)
  assert.equal(visit.visits[0].hasSnapshot, true)
  assert.match(visit.markdown, /Readable web content/)
  const id = visit.visits[0].id
  const snapshot = await first(`/api/browser?snapshot=${id}`)
  assert.equal(snapshot.headers.get("content-type"), "image/png")
  assert.equal(
    Buffer.from(await snapshot.arrayBuffer()).toString("base64"),
    png
  )
  assert.deepEqual((await (await second("/api/browser")).json()).visits, [])
  await second(`/api/browser?snapshot=${id}`, undefined, 404)
  await first("/api/browser", {
    url: "https://example.com/",
    title: "Updated title",
  })
  assert.equal(extractions, 1, "Reopening a site must reuse its saved snapshot")
  const refresh = await (
    await first("/api/browser", { url: "https://example.com/", refresh: true })
  ).json()
  assert.equal(
    refresh.visits.length,
    1,
    "Repeated visits must not duplicate cards"
  )
  assert.equal(extractions, 2)
  const native = await (
    await first("/api/browser", {
      url: "https://native.example/",
      title: "Native site",
      recordOnly: true,
    })
  ).json()
  assert.equal(extractions, 2, "Native visits must not trigger paid extraction")
  assert.equal(native.visits[0].hasSnapshot, false)
  const savedNative = await (
    await first("/api/browser", {
      url: "https://native.example/",
      title: "Native site",
      screenshot: png,
    })
  ).json()
  assert.equal(savedNative.visits[0].hasSnapshot, true)
  assert.equal(
    extractions,
    2,
    "Native screenshots must be stored without Nimble"
  )
  await first(
    "/api/browser",
    { url: "https://native.example/", screenshot: "invalid" },
    400
  )
  for (const url of [
    "javascript:alert(1)",
    "http://127.0.0.1/",
    "http://localhost/",
    "https://user:password@example.com/",
  ])
    await first("/api/browser", { url }, 400)
  await first(
    "/api/browser",
    { url: "https://example.com/" },
    403,
    "https://other.example"
  )
  const failed = await (
    await first("/api/browser", { url: "https://failure.example/" })
  ).json()
  assert.equal(
    failed.visits.length,
    3,
    "Capture failure must preserve the visit"
  )
  assert.ok(failed.snapshotError)
  console.log(
    "Passed: search, unsafe-result filtering, errors, history, PNG delivery, browser isolation, snapshot reuse/refresh, URL validation, origin checks, capture failure."
  )
} catch (error) {
  console.error(output.slice(-5000))
  throw error
} finally {
  child.kill()
  await new Promise((resolve) =>
    child.exitCode !== null ? resolve() : child.once("exit", resolve)
  )
  await new Promise((resolve) => mock.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
