// Electron's sandboxed preload supports CommonJS, not ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron")

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld("goodscrollBrowser", {
  open: (url) => ipcRenderer.invoke("browser:open", url),
  external: (url) => ipcRenderer.invoke("browser:external", url),
  command: (action) => ipcRenderer.invoke("browser:command", action),
  layout: (bounds, visible) =>
    ipcRenderer.invoke("browser:layout", bounds, visible),
  onState: (callback) => subscribe("browser:state", callback),
  onSnapshot: (callback) => subscribe("browser:snapshot", callback),
})
