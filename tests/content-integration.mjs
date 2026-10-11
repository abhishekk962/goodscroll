import assert from "node:assert/strict"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { randomUUID } from "node:crypto"
import test from "node:test"

test(
  "project content pipeline persists, isolates, deduplicates and replenishes",
  { timeout: 90_000 },
  async () => {
    const projects = ["alpha", "beta"].map((id) => ({
      id,
      worktree: `/${id}`,
      time: { created: 1, updated: 1 },
    }))
    const sessions = projects.map((project) => ({
      id: `${project.id}-chat`,
      projectID: project.id,
      directory: project.worktree,
      title: "Learning caching",
      time: { created: 1, updated: 2 },
    }))
    let agentCalls = 0
    let topicCalls = 0
    let sequence = 0
    let invalidContent = false
    const generationInputs = []
    const mock = createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost")
      const directory = decodeURIComponent(
        req.headers["x-opencode-directory"] ??
          url.searchParams.get("directory") ??
          "/alpha"
      )
      const projectID = directory.slice(1)
      let raw = ""
      for await (const chunk of req) raw += chunk
      const body = raw ? JSON.parse(raw) : {}
      let data
      if (url.pathname === "/project") data = projects
      else if (url.pathname === "/provider")
        data = {
          connected: ["mock"],
          default: { mock: "whisper" },
          all: [
            {
              id: "mock",
              models: {
                whisper: {
                  id: "whisper",
                  capabilities: {
                    input: { text: false },
                    output: { text: true },
                  },
                },
                chat: {
                  id: "chat",
                  capabilities: {
                    input: { text: true },
                    output: { text: true },
                  },
                },
              },
            },
          ],
        }
      else if (url.pathname === "/agent")
        data =
          projectID === "beta"
            ? [{ name: "build", mode: "primary" }]
            : [
                { name: "goodscroll-topics", mode: "primary" },
                { name: "goodscroll-content", mode: "primary" },
              ]
      else if (url.pathname === "/config" && req.method === "PATCH") {
        assert.ok(body.agent["goodscroll-topics"])
        assert.ok(body.agent["goodscroll-content"])
        data = body
      } else if (url.pathname === "/session" && req.method === "GET")
        data = sessions
      else if (url.pathname === "/session" && req.method === "POST") {
        data = {
          id: `agent-${++sequence}`,
          projectID,
          directory,
          title: body.title,
          time: { created: 1, updated: 1 },
        }
        sessions.push(data)
      } else if (
        url.pathname.match(/^\/session\/[^/]+\/message$/) &&
        req.method === "GET"
      ) {
        data = [
          {
            info: { id: "message-1", role: "user" },
            parts: [
              {
                type: "text",
                text: "Explain cache invalidation and choosing a useful TTL.",
              },
            ],
          },
        ]
      } else if (
        url.pathname.match(/^\/session\/[^/]+\/message$/) &&
        req.method === "POST"
      ) {
        agentCalls++
        assert.equal(
          body.model.modelID,
          "chat",
          "generation avoids non-chat provider defaults"
        )
        assert.equal(body.tools["*"], false)
        const input = JSON.parse(body.parts[0].text)
        let result
        if (
          body.agent === "goodscroll-topics" ||
          (body.agent === "build" && input.conversations)
        ) {
          if (body.agent === "build")
            assert.match(body.system, /Extract up to 8 distinct topics/)
          topicCalls++
          assert.deepEqual(
            input.conversations.map((item) => item.id),
            [`${projectID}-chat`]
          )
          result = {
            topics: [
              {
                title: "Cache invalidation",
                summary: "Choosing a TTL and invalidating stale data.",
                sources: [`${projectID}-chat`],
              },
            ],
          }
        } else {
          generationInputs.push({ projectID, input, system: body.system })
          if (body.agent === "build")
            assert.match(body.system, /educational content agent/)
          result = {
            items: Object.entries(input.requestedCounts).flatMap(
              ([kind, count]) =>
                Array.from({ length: count }, (_, index) => ({
                  topicID: input.topics[0].id,
                  kind,
                  title: `Caching ${agentCalls}-${kind}-${index}`,
                  body: "Use a short TTL when freshness matters. Invalidate after a write.",
                  slides: [
                    "Choose a TTL",
                    "Invalidate after writes",
                    "Measure your cache hit rate",
                  ],
                }))
            ),
          }
        }
        if (invalidContent && result.items)
          result.items[0].topicID = "wrong-project-topic"
        data = {
          info: { role: "assistant" },
          parts: [{ type: "text", text: JSON.stringify(result) }],
        }
      } else if (
        url.pathname.startsWith("/session/") &&
        req.method === "DELETE"
      )
        data = true
      else {
        res.writeHead(404)
        res.end(
          JSON.stringify({ error: `Unhandled ${req.method} ${url.pathname}` })
        )
        return
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(data))
    })
    await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve))
    const mockPort = mock.address().port
    const port = Number(process.env.GOODSCROLL_TEST_PORT ?? 4319)
    mkdirSync(".goodscroll", { recursive: true })
    const path = resolve(`.goodscroll/integration-${Date.now()}.sqlite`)
    let output = ""
    const app = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
      {
        windowsHide: true,
        env: {
          ...process.env,
          OPENCODE_SERVER_URL: `http://127.0.0.1:${mockPort}`,
          GOODSCROLL_DB_PATH: path,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    app.stdout.on("data", (chunk) => {
      output += chunk
    })
    app.stderr.on("data", (chunk) => {
      output += chunk
    })
    const base = `http://127.0.0.1:${port}`
    async function request(project, body) {
      const response = await fetch(
        `${base}/api/feed?project=${project}`,
        body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
      )
      return { status: response.status, data: await response.json() }
    }
    async function eventually(check, timeout = 15_000) {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        try {
          if (await check()) return
        } catch {
          /* starting or pending */
        }
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      assert.fail(`Timed out. Server output:\n${output}`)
    }
    let database
    try {
      let lastResponse
      await eventually(async () => {
        lastResponse = await request("alpha")
        if (lastResponse.status !== 200)
          output += `\nAPI response: ${JSON.stringify(lastResponse)}`
        return lastResponse.status === 200
      })
      await Promise.all(Array.from({ length: 4 }, () => request("alpha", {})))
      await eventually(
        async () => (await request("alpha")).data.items.length === 12
      )
      assert.equal(
        agentCalls,
        2,
        "concurrent requests run one extraction and one content agent"
      )
      const alpha = (await request("alpha")).data
      assert.equal(alpha.items.filter((item) => item.kind === "post").length, 6)
      assert.equal(alpha.items.filter((item) => item.kind === "reel").length, 6)
      assert.equal((await request("beta")).data.items.length, 0)
      assert.equal(
        (await request("beta", { seenID: alpha.items[0].id })).status,
        404
      )
      assert.equal((await request("alpha", null)).status, 400)
      const rejected = await fetch(`${base}/api/feed?project=alpha`, {
        method: "POST",
        headers: {
          Origin: "http://evil.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
      assert.equal(rejected.status, 403)
      const posts = alpha.items.filter((item) => item.kind === "post")
      const feedbackRequest = async (
        project,
        id,
        method = "GET",
        body,
        origin = base
      ) => {
        const response = await fetch(
          `${base}/api/posts/${id}/feedback?project=${project}`,
          {
            method,
            headers: { Origin: origin, "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }
        )
        return { status: response.status, data: await response.json() }
      }
      assert.equal(
        (await feedbackRequest("alpha", posts[0].id)).data.liked,
        false
      )
      for (let i = 0; i < 2; i++) {
        const liked = await feedbackRequest("alpha", posts[0].id, "PUT", {
          liked: true,
        })
        assert.equal(liked.status, 200, JSON.stringify(liked) + output)
        assert.equal(liked.data.liked, true)
      }
      assert.equal(
        (await feedbackRequest("alpha", posts[0].id, "PUT", { liked: false }))
          .data.liked,
        false
      )
      await feedbackRequest("alpha", posts[0].id, "PUT", { liked: true })
      const comment = {
        id: randomUUID(),
        body: "Please show a concrete TTL example with numbers.",
      }
      for (let i = 0; i < 2; i++)
        assert.equal(
          (await feedbackRequest("alpha", posts[0].id, "POST", comment)).data
            .commentCount,
          1
        )
      assert.equal(
        (await feedbackRequest("alpha", posts[1].id, "POST", comment)).status,
        409
      )
      assert.equal(
        (
          await feedbackRequest("alpha", posts[0].id, "POST", {
            ...comment,
            body: "changed",
          })
        ).status,
        409
      )
      assert.equal(
        (await feedbackRequest("beta", posts[0].id, "PUT", { liked: true }))
          .status,
        404
      )
      assert.equal(
        (
          await feedbackRequest("beta", posts[0].id, "POST", {
            ...comment,
            id: randomUUID(),
          })
        ).status,
        404
      )
      assert.equal(
        (
          await feedbackRequest(
            "alpha",
            alpha.items.find((item) => item.kind === "reel").id
          )
        ).status,
        404
      )
      assert.equal(
        (await feedbackRequest("alpha", posts[0].id, "PUT", { liked: "true" }))
          .status,
        400
      )
      for (const body of ["  ", "x".repeat(1001)])
        assert.equal(
          (
            await feedbackRequest("alpha", posts[0].id, "POST", {
              id: randomUUID(),
              body,
            })
          ).status,
          400
        )
      assert.equal(
        (
          await feedbackRequest(
            "alpha",
            posts[0].id,
            "PUT",
            { liked: true },
            "http://evil.example"
          )
        ).status,
        403
      )
      for (const item of posts.slice(0, 3))
        assert.equal((await request("alpha", { seenID: item.id })).status, 200)
      assert.equal(
        (await request("alpha", { seenID: posts[0].id })).status,
        200,
        "seen updates are idempotent"
      )
      assert.equal((await request("alpha")).data.items.length, 9)
      assert.ok(
        (await request("alpha")).data.history.some(
          (item) => item.id === posts[0].id
        )
      )
      assert.equal(
        (await feedbackRequest("alpha", posts[0].id)).data.comments[0].body,
        comment.body,
        "seen posts retain their comments"
      )
      await new Promise((resolve) => setTimeout(resolve, 15_100))
      await request("alpha", { seenID: posts[3].id })
      await eventually(
        async () =>
          (await request("alpha")).data.items.filter(
            (item) => item.kind === "post"
          ).length === 6
      )
      assert.equal(
        topicCalls,
        1,
        "unchanged conversations do not rerun extraction"
      )
      assert.equal(agentCalls, 3)
      const adapted = generationInputs.at(-1)
      assert.equal(adapted.input.feedback[0].liked, true)
      assert.equal(adapted.input.feedback[0].topicID, alpha.topics[0].id)
      assert.deepEqual(adapted.input.feedback[0].comments, [comment.body])
      assert.match(adapted.system, /Instagram-style educational carousels/)
      database = new DatabaseSync(path)
      assert.equal(
        database.prepare("SELECT COUNT(*) AS count FROM post_likes").get()
          .count,
        1
      )
      assert.equal(
        database.prepare("SELECT COUNT(*) AS count FROM post_comments").get()
          .count,
        1
      )
      assert.equal(
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM content WHERE seen_at IS NOT NULL"
          )
          .get().count,
        4
      )
      assert.equal(
        database.prepare("SELECT COUNT(*) AS count FROM topics").get().count,
        1
      )
      await request("beta", {})
      await eventually(
        async () => (await request("beta")).data.items.length === 12
      )
      const beta = (await request("beta")).data
      assert.deepEqual(
        generationInputs.at(-1).input.feedback,
        [],
        "feedback stays in its project"
      )
      assert.notEqual(beta.topics[0].id, alpha.topics[0].id)
      assert.equal(
        database
          .prepare("SELECT COUNT(DISTINCT scope) AS count FROM content")
          .get().count,
        2
      )
      assert.equal((await request("alpha")).data.items.length, 12)
      // Force an empty queue to exercise validation and durable failure backoff.
      const betaScope = database
        .prepare("SELECT scope FROM topics WHERE id=?")
        .get(beta.topics[0].id).scope
      database
        .prepare("UPDATE content SET seen_at=? WHERE scope=?")
        .run(Date.now(), betaScope)
      database
        .prepare("UPDATE pipeline SET retry_at=0 WHERE scope=?")
        .run(betaScope)
      invalidContent = true
      await request("beta", {})
      await eventually(async () => Boolean((await request("beta")).data.error))
      assert.equal(
        (await request("beta")).data.items.length,
        0,
        "invalid output is never persisted"
      )
      const failed = database
        .prepare("SELECT * FROM pipeline WHERE scope=?")
        .get(betaScope)
      assert.equal(failed.lease, null)
      assert.ok(failed.retry_at > Date.now())
      const callsBeforeRetry = agentCalls
      await request("beta", {})
      assert.equal(
        agentCalls,
        callsBeforeRetry,
        "failures honor persisted cooldown"
      )
    } finally {
      database?.close()
      app.kill()
      await new Promise((resolve) => mock.close(resolve))
    }
  }
)
