// Run with Electron: pnpm test:desktop. Uses local fixtures, no Nimble calls.
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { rm } from "node:fs/promises"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "electron"
import { websiteURL, trustedAppURL } from "../desktop/url-policy.mjs"

const directory = mkdtempSync(join(tmpdir(), "goodscroll-desktop-test-"))
app.setPath("userData", directory)
app.commandLine.appendSwitch(
  "host-resolver-rules",
  "MAP fixture.goodscroll.test 127.0.0.1"
)
app.commandLine.appendSwitch("no-proxy-server")
process.env.GOODSCROLL_DESKTOP_TEST = "1"
async function run() {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html")
    response.setHeader("X-Frame-Options", "DENY")
    response.setHeader("Content-Security-Policy", "frame-ancestors 'none'")
    response.end(
      request.url === "/search"
        ? "<html><title>Goodscroll fixture</title><body>Trusted app</body></html>"
        : `<html><title>${request.url === "/second" ? "Second page" : "First page"}</title><body style="background:#e0f2fe"><h1>Visible native page</h1><a id="next" href="/second">Next</a></body></html>`
    )
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const origin = `http://localhost:${server.address().port}`
  const realApp = process.argv
    .find((value) => value.startsWith("--app="))
    ?.slice(6)
  process.env.GOODSCROLL_APP_URL = realApp ?? `${origin}/search`
  const website = `http://fixture.goodscroll.test:${server.address().port}`
  let window
  let browser
  async function until(check) {
    for (let i = 0; i < 100; i++) {
      if (await check()) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error("Timed out waiting for native browser")
  }
  let exitCode = 0
  try {
    ;({ window, browser } = await (await import("../desktop/main.mjs")).ready)
    // Chromium needs a display surface for real screenshots. Do not take focus.
    window.showInactive()
    const invoke = (script) => window.webContents.executeJavaScript(script)
    assert.equal(
      await invoke("typeof window.goodscrollBrowser.open"),
      "function"
    )
    if (realApp) {
      await invoke(
        `fetch('/api/browser', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:${JSON.stringify(`${website}/first`)},title:'Native fixture visit',recordOnly:true})}).then(r=>{if(!r.ok)throw new Error('History fixture failed'); return true})`
      )
      const loaded = new Promise((resolve) =>
        window.webContents.once("did-finish-load", resolve)
      )
      window.webContents.reload()
      await loaded
      await until(() =>
        invoke(
          `Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Native fixture visit'))`
        )
      )
    }
    await invoke(
      "window.snapshots=[]; window.goodscrollBrowser.onSnapshot(s => window.snapshots.push(s)); undefined"
    )
    await invoke(
      `window.goodscrollBrowser.layout({x:20,y:100,width:480,height:600},true)`
    )
    if (realApp)
      await window.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Native fixture visit')).click()`,
        true
      )
    else
      await invoke(
        `window.goodscrollBrowser.open(${JSON.stringify(`${website}/first`)})`
      )
    await until(
      () => browser.state().url.endsWith("/first") && !browser.state().loading
    )
    assert.equal(browser.state().error, null)
    assert.equal(browser.state().title, "First page")
    assert.equal(
      await browser.view.webContents.executeJavaScript(
        'document.querySelector("h1").textContent'
      ),
      "Visible native page"
    )
    assert.equal(
      await browser.view.webContents.executeJavaScript(
        "typeof window.goodscrollBrowser"
      ),
      "undefined"
    )
    assert.equal(
      await browser.view.webContents.executeJavaScript("typeof require"),
      "undefined"
    )
    await until(() => invoke("window.snapshots.length > 0"))
    const snapshot = await invoke("window.snapshots[0]")
    assert.equal(snapshot.url, `${website}/first`)
    assert.ok(snapshot.screenshot.startsWith("iVBOR"))
    if (realApp) {
      await until(() =>
        invoke(
          `fetch('/api/browser').then(r=>r.json()).then(d=>d.visits.some(v=>v.url===${JSON.stringify(`${website}/first`)} && v.hasSnapshot))`
        )
      )
      assert.ok(
        browser.view.getBounds().height > 200,
        "React must position the native browser view"
      )
    }
    await browser.view.webContents.executeJavaScript(
      'document.querySelector("#next").click()',
      true
    )
    await until(
      () => browser.state().url.endsWith("/second") && !browser.state().loading
    )
    await until(() => browser.state().canGoBack)
    await invoke('window.goodscrollBrowser.command("back")')
    await until(
      () => browser.state().url.endsWith("/first") && !browser.state().loading
    )
    assert.equal(browser.state().canGoForward, true)
    await invoke('window.goodscrollBrowser.command("forward")')
    await until(
      () => browser.state().url.endsWith("/second") && !browser.state().loading
    )
    await assert.rejects(
      invoke('window.goodscrollBrowser.open("file:///C:/Windows/win.ini")')
    )
    await assert.rejects(
      invoke('window.goodscrollBrowser.command("arbitrary-command")')
    )
    await assert.rejects(
      invoke(
        `window.goodscrollBrowser.open(${JSON.stringify(`${origin}/api/browser`)})`
      )
    )
    assert.throws(() => websiteURL("https://user:secret@example.com/", origin))
    assert.equal(trustedAppURL(`${origin}/search`, origin), true)
    assert.equal(trustedAppURL("https://example.com/", origin), false)
    await invoke(
      "window.goodscrollBrowser.layout({x:0,y:0,width:0,height:0},false)"
    )
    assert.equal(browser.visible, false)
    await invoke('window.goodscrollBrowser.command("close")')
    assert.equal(browser.view, null)
    console.log(
      "Passed: iframe-blocking site visible, native link navigation, back/forward, PNG capture, preload IPC, remote isolation, URL policy, visibility and cleanup."
    )
  } catch (error) {
    exitCode = 1
    console.error(error)
  } finally {
    window?.destroy()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    // Electron's session files can remain locked until the process exits.
    await rm(directory, { recursive: true, force: true }).catch(() => {})
    app.exit(exitCode)
  }
}
void app
  .whenReady()
  .then(run)
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
