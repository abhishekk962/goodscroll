import { WebContentsView } from "electron"
import { websiteURL } from "./url-policy.mjs"

export class SiteBrowser {
  constructor(window, appOrigin) {
    this.window = window
    this.appOrigin = appOrigin
    this.view = null
    this.error = null
    this.bounds = null
    this.visible = true
    this.sequence = 0
  }

  state() {
    const contents = this.view?.webContents
    return contents && !contents.isDestroyed()
      ? {
          url: contents.getURL(),
          title: contents.getTitle(),
          loading: contents.isLoading(),
          canGoBack: contents.navigationHistory.canGoBack(),
          canGoForward: contents.navigationHistory.canGoForward(),
          error: this.error,
        }
      : {
          url: "",
          title: "",
          loading: false,
          canGoBack: false,
          canGoForward: false,
          error: null,
        }
  }

  emit() {
    if (!this.window.isDestroyed())
      this.window.webContents.send("browser:state", this.state())
  }

  create() {
    if (this.view) return
    this.view = new WebContentsView({
      webPreferences: {
        partition: "persist:goodscroll-sites",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    })
    this.window.contentView.addChildView(this.view)
    const contents = this.view.webContents
    const blocked = (value) => {
      try {
        websiteURL(value, this.appOrigin)
        return false
      } catch {
        return true
      }
    }
    contents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false)
    )
    contents.session.setPermissionCheckHandler(() => false)
    contents.session.on("will-download", (event) => event.preventDefault())
    // Remote content has no preload, app cookies, IPC privileges, or local-file access.
    contents.session.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const privateTarget =
        url.origin === this.appOrigin ||
        url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") ||
        url.hostname.endsWith(".local") ||
        url.hostname.endsWith(".internal") ||
        url.hostname.includes(":") ||
        /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(
          url.hostname
        )
      callback({
        cancel:
          privateTarget ||
          !["http:", "https:", "data:", "blob:"].includes(url.protocol),
      })
    })
    contents.on("will-navigate", (event, url) => {
      if (blocked(url)) event.preventDefault()
    })
    contents.on("will-redirect", (event, url) => {
      if (blocked(url)) event.preventDefault()
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (!blocked(url)) void this.open(url).catch(() => {})
      return { action: "deny" }
    })
    contents.on("did-start-navigation", (_event, _url, _inPlace, mainFrame) => {
      if (mainFrame) {
        this.sequence++
        this.error = null
        this.emit()
      }
    })
    for (const name of [
      "did-start-loading",
      "did-stop-loading",
      "did-navigate",
      "page-title-updated",
    ])
      contents.on(name, () => this.emit())
    contents.on(
      "did-fail-load",
      (_event, code, description, _url, mainFrame) => {
        if (mainFrame && code !== -3) {
          this.error = `Page could not load: ${description}`
          this.emit()
        }
      }
    )
    contents.on("did-finish-load", () => {
      this.emit()
      const sequence = this.sequence
      // Let Chromium paint before taking the history preview.
      setTimeout(() => {
        if (sequence === this.sequence) void this.snapshot()
      }, 350)
    })
    contents.on("did-navigate-in-page", (_event, _url, mainFrame) => {
      if (mainFrame) {
        this.sequence++
        this.emit()
        void this.snapshot()
      }
    })
    contents.on("render-process-gone", () => {
      this.error = "The page stopped responding. Reload to continue."
      this.emit()
    })
    this.layout(this.bounds, this.visible)
  }

  async open(value) {
    const url = websiteURL(value, this.appOrigin)
    this.create()
    await this.view.webContents.loadURL(url).catch((error) => {
      if (error.code !== "ERR_ABORTED") {
        this.error = "This page could not load. Try Reader or reload."
        this.emit()
      }
    })
    return this.state()
  }

  layout(bounds, visible = true) {
    this.visible = Boolean(visible)
    if (
      bounds &&
      ["x", "y", "width", "height"].every((key) => Number.isFinite(bounds[key]))
    )
      this.bounds = bounds
    if (!this.view) return
    const [width, height] = this.window.getContentSize()
    const b = this.bounds ?? { x: 0, y: 0, width: 0, height: 0 }
    const x = Math.max(0, Math.min(width, Math.round(b.x)))
    const y = Math.max(0, Math.min(height, Math.round(b.y)))
    this.view.setBounds({
      x,
      y,
      width: Math.max(0, Math.min(width - x, Math.round(b.width))),
      height: Math.max(0, Math.min(height - y, Math.round(b.height))),
    })
    this.view.setVisible(this.visible && b.width > 0 && b.height > 0)
  }

  async snapshot() {
    const contents = this.view?.webContents
    if (!contents || contents.isDestroyed() || this.error) return
    const url = contents.getURL()
    try {
      websiteURL(url, this.appOrigin)
    } catch {
      return
    }
    const sequence = this.sequence
    try {
      const bounds = this.view.getBounds()
      const image = await contents.capturePage(
        { x: 0, y: 0, width: bounds.width, height: bounds.height },
        {
          stayHidden: true,
          stayAwake: true,
        }
      )
      if (
        this.view?.webContents !== contents ||
        contents.isDestroyed() ||
        sequence !== this.sequence ||
        image.isEmpty()
      )
        return
      this.window.webContents.send("browser:snapshot", {
        url,
        title: contents.getTitle() || new URL(url).hostname,
        screenshot: image.toPNG().toString("base64"),
      })
    } catch (error) {
      console.warn("Goodscroll browser snapshot failed:", error.message)
    }
  }

  async command(action) {
    const contents = this.view?.webContents
    if (!contents) return this.state()
    if (action === "back" && contents.navigationHistory.canGoBack())
      contents.navigationHistory.goBack()
    else if (action === "forward" && contents.navigationHistory.canGoForward())
      contents.navigationHistory.goForward()
    else if (action === "reload") contents.reload()
    else if (action === "close") {
      await this.snapshot()
      this.close()
    }
    return this.state()
  }

  close() {
    this.sequence++
    if (this.view) {
      this.window.contentView.removeChildView(this.view)
      this.view.webContents.close()
      this.view = null
    }
    this.emit()
  }
}
