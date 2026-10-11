// Run with an existing dev server: node tests/account-settings.integration.mjs
// Uses mock OpenCode servers and isolated cookie jars; never changes your browser.
import assert from "node:assert/strict"
import { createServer } from "node:http"

const app = process.env.GOODSCROLL_TEST_URL ?? "http://localhost:3000"
const projects = [
  { id: "global", worktree: "/", time: { created: 1 } },
  { id: "alpha", worktree: "/workspace/alpha", time: { created: 1 } },
  { id: "beta", worktree: "/workspace/beta", time: { created: 1 } },
]
const prompts = []
const servers = []

async function mock() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://mock")
    const protectedPath = url.pathname.startsWith("/protected/")
    const route = url.pathname.replace(/^\/protected/, "")
    response.setHeader("Content-Type", "application/json")
    const send = (data, status = 200) => {
      response.statusCode = status
      response.end(JSON.stringify(data))
    }
    if (
      protectedPath &&
      request.headers.authorization !==
        `Basic ${Buffer.from("opencode:test-only-password").toString("base64")}`
    )
      return send({ error: "Unauthorized" }, 401)
    const directory =
      url.searchParams.get("directory") ??
      decodeURIComponent(request.headers["x-opencode-directory"] ?? "/")
    if (route === "/project") return send(projects)
    if (route === "/path") return send({ directory })
    if (route === "/file") return send([])
    if (route === "/project/current")
      return send(
        projects.find(
          (project) =>
            project.id !== "global" && directory.startsWith(project.worktree)
        ) ?? projects[0]
      )
    if (route === "/provider")
      return send({
        connected: ["fixture"],
        all: [
          {
            id: "fixture",
            name: "Fixture",
            models: {
              one: { id: "one", name: "Model one" },
              two: { id: "two", name: "Model two" },
            },
          },
        ],
        default: { fixture: "one" },
      })
    if (route === "/session/status") return send({})
    if (route === "/session" && request.method === "GET") return send([])
    if (route === "/session/session-alpha")
      return send({
        id: "session-alpha",
        projectID: "alpha",
        directory: "/workspace/alpha",
        title: "Fixture chat",
        time: { created: 1, updated: 1 },
      })
    if (route === "/session/session-alpha/prompt_async") {
      let body = ""
      for await (const part of request) body += part
      prompts.push(JSON.parse(body))
      response.statusCode = 204
      return response.end()
    }
    return send({ error: `Unknown mock route: ${route}` }, 404)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

function browser() {
  const jar = new Map()
  return async (path, body, expected = 200, origin = app) => {
    const response = await fetch(`${app}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    assert.equal(response.status, expected, `${path}: ${text.slice(0, 500)}`)
    for (const cookie of response.headers.getSetCookie()) {
      assert.match(cookie, /HttpOnly/i)
      assert.match(cookie, /Max-Age=31536000/i)
      const pair = cookie.split(";")[0]
      const index = pair.indexOf("=")
      jar.set(pair.slice(0, index), pair.slice(index + 1))
    }
    return response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : text
  }
}

try {
  const urlA = await mock()
  const urlB = await mock()
  const first = browser()
  const second = browser()
  const settings = (url, extras = {}) => ({
    scope: "app",
    action: "save",
    baseUrl: url,
    username: "opencode",
    authenticated: false,
    timeoutSeconds: 2,
    ...extras,
  })

  await first("/api/settings", settings(urlA))
  await second("/api/settings", settings(urlB))
  assert.match(await first("/profile"), /Switch account/)
  await first("/api/project-select", { projectID: "alpha" })
  await first("/api/folders", {
    action: "folder",
    projectID: "alpha",
    directory: "/workspace/alpha/src",
  })
  await first("/api/settings", {
    scope: "project",
    projectID: "alpha",
    model: "fixture/one",
  })
  await first("/api/project-select", { projectID: "beta" })
  assert.doesNotMatch(await first("/profile"), /\/workspace\/alpha\/src/)
  await first("/api/project-select", { projectID: "alpha" })
  let profile = await first("/profile")
  assert.match(profile, /\/workspace\/alpha\/src/)
  assert.match(profile, /value="fixture\/one" selected/)

  await first(
    "/api/folders",
    { action: "folder", projectID: "alpha", directory: "/workspace/beta" },
    400
  )
  await first(
    "/api/folders",
    { action: "folder", projectID: "global", directory: "/workspace/alpha" },
    400
  )
  await first("/api/project-select", { projectID: "missing" }, 400)
  assert.match(await first("/profile"), /\/workspace\/alpha\/src/)
  await first("/api/folders", {
    action: "add",
    directory: "/workspace/beta/tools",
  })
  assert.match(await first("/profile"), /\/workspace\/beta\/tools/)

  // Test candidates do not replace the saved connection or its project choice.
  await first("/api/settings", settings(urlB, { action: "test" }))
  assert.match(await first("/profile"), /\/workspace\/beta\/tools/)
  await first("/api/settings", settings(urlB))
  assert.doesNotMatch(await first("/profile"), /\/workspace\/beta\/tools/)
  await first("/api/settings", settings(urlA))
  assert.match(await first("/profile"), /\/workspace\/beta\/tools/)
  assert.doesNotMatch(await second("/profile"), /\/workspace\/beta\/tools/)

  await first("/api/project-select", { projectID: "alpha" })
  await first(
    "/api/messages/session-alpha",
    { text: "Project default fixture" },
    202
  )
  assert.deepEqual(prompts.at(-1).model, {
    providerID: "fixture",
    modelID: "one",
  })
  await first(
    "/api/messages/session-alpha",
    { text: "Chat override fixture", model: "fixture/two" },
    202
  )
  assert.deepEqual(prompts.at(-1).model, {
    providerID: "fixture",
    modelID: "two",
  })
  await first("/api/settings", {
    scope: "project",
    projectID: "alpha",
    model: null,
  })
  await first(
    "/api/messages/session-alpha",
    { text: "OpenCode fallback fixture" },
    202
  )
  assert.equal(prompts.at(-1).model, undefined)
  await first(
    "/api/settings",
    { scope: "project", projectID: "alpha", model: "missing/model" },
    400
  )

  await first(
    "/api/settings",
    settings(`${urlA}/protected`, {
      authenticated: true,
      password: "test-only-password",
    })
  )
  profile = await first("/profile")
  assert.match(profile, /Switch account/)
  assert.doesNotMatch(profile, /test-only-password/)
  await first(
    "/api/settings",
    settings(`${urlA}/protected`, { action: "test", authenticated: true })
  )
  await first(
    "/api/settings",
    settings(`${urlB}/protected`, { action: "test", authenticated: true }),
    400
  )
  await first(
    "/api/settings",
    settings(`${urlA}/protected`, {
      action: "test",
      authenticated: true,
      password: "incorrect",
    }),
    502
  )
  await first("/api/settings", settings("file:///invalid"), 400)
  await first("/api/settings", settings(urlA, { timeoutSeconds: 0 }), 400)
  await first(
    "/api/project-select",
    { projectID: "alpha" },
    403,
    "http://other-origin.test"
  )
  await first("/api/settings", settings(urlA), 403, "http://other-origin.test")
  await first("/api/settings", settings("http://127.0.0.1:1"))
  assert.match(await first("/profile"), /Could not connect to OpenCode/)
  assert.match(await first("/messages"), /Could not connect to OpenCode/)
  console.log(
    "PASS: browser isolation, project/server persistence, folder boundaries, add project, connection testing, authentication, model inheritance, validation, and failure recovery"
  )
} finally {
  await Promise.all(
    servers.map((server) => new Promise((resolve) => server.close(resolve)))
  )
}
