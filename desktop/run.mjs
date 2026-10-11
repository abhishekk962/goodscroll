import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"
import electron from "electron"

const development = process.argv.includes("--dev")
let server
let shell
let url = process.env.GOODSCROLL_APP_URL
if (!url && development) {
  try {
    const response = await fetch("http://localhost:3000/api/search?q=", {
      signal: AbortSignal.timeout(1500),
    })
    if (response.status === 400) url = "http://localhost:3000/search"
  } catch {}
}
if (!url) {
  const listener = createServer()
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve))
  const port = listener.address().port
  await new Promise((resolve) => listener.close(resolve))
  url = `http://localhost:${port}/search`
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      development ? "dev" : "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { stdio: "inherit", windowsHide: true }
  )
  let ready = false
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error(
        "Goodscroll server failed to start. Run pnpm build for production mode."
      )
    try {
      const response = await fetch(new URL("/api/search?q=", url), {
        signal: AbortSignal.timeout(1000),
      })
      if (response.status === 400) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!ready) {
    server.kill()
    throw new Error("Goodscroll server did not become ready")
  }
}
const environment = { ...process.env, GOODSCROLL_APP_URL: url }
delete environment.ELECTRON_RUN_AS_NODE
shell = spawn(
  electron,
  [fileURLToPath(new URL("./main.mjs", import.meta.url))],
  { stdio: "inherit", env: environment }
)
function cleanup() {
  shell?.kill()
  server?.kill()
}
process.on("SIGINT", cleanup)
process.on("SIGTERM", cleanup)
shell.on("error", (error) => {
  console.error(error.message)
  cleanup()
  process.exitCode = 1
})
shell.on("exit", (code) => {
  server?.kill()
  process.exitCode = code ?? 0
})
