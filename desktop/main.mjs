import { app, BrowserWindow, ipcMain, shell } from "electron"
import { fileURLToPath } from "node:url"
import { SiteBrowser } from "./browser.mjs"
import { trustedAppURL, websiteURL } from "./url-policy.mjs"

const target = new URL(
  process.env.GOODSCROLL_APP_URL ?? "http://localhost:3000/search"
)
if (
  target.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(target.hostname)
)
  throw new Error("The desktop shell requires a local Goodscroll server")
app.setName("Goodscroll")
let window
let browser
// Do not await app.whenReady at ESM top level: module evaluation gates ready.
export const ready = app.whenReady().then(async () => {
  window = new BrowserWindow({
    show: process.env.GOODSCROLL_DESKTOP_TEST !== "1",
    width: 560,
    height: 900,
    minWidth: 400,
    minHeight: 600,
    title: "Goodscroll",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: "persist:goodscroll-app",
    },
  })
  browser = new SiteBrowser(window, target.origin)
  // A launcher can start without a console window; explicitly show the app.
  if (process.env.GOODSCROLL_DESKTOP_TEST !== "1") window.show()
  const trusted = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    trustedAppURL(event.senderFrame.url, target.origin)
  function handle(channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trusted(event)) throw new Error("Untrusted browser request")
      return handler(...args)
    })
  }
  handle("browser:open", (url) => browser.open(url))
  handle("browser:external", (url) =>
    shell.openExternal(websiteURL(url, target.origin))
  )
  handle("browser:command", (action) => {
    if (!["back", "forward", "reload", "close"].includes(action))
      throw new Error("Invalid browser command")
    return browser.command(action)
  })
  handle("browser:layout", (bounds, visible) => {
    browser.layout(bounds, visible)
  })
  window.webContents.on("will-navigate", (event, url) => {
    if (!trustedAppURL(url, target.origin)) event.preventDefault()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  window.webContents.on(
    "did-start-navigation",
    (_event, _url, _inPlace, mainFrame) => {
      if (mainFrame) browser.close()
    }
  )
  window.on("resize", () => browser.layout(browser.bounds, browser.visible))
  window.on("close", () => browser.close())
  window.on("closed", () => {
    window = null
  })
  app.on("window-all-closed", () => {
    if (process.env.GOODSCROLL_DESKTOP_TEST !== "1") app.quit()
  })
  await window.loadURL(target.href)
  return { window, browser }
})
