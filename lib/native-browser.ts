export type NativeBrowserState = {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: string | null
}
export type NativeSnapshot = { url: string; title: string; screenshot: string }
export type NativeBrowser = {
  open(url: string): Promise<NativeBrowserState>
  external(url: string): Promise<void>
  command(
    action: "back" | "forward" | "reload" | "close"
  ): Promise<NativeBrowserState>
  layout(
    bounds: { x: number; y: number; width: number; height: number },
    visible: boolean
  ): Promise<void>
  onState(callback: (state: NativeBrowserState) => void): () => void
  onSnapshot(callback: (snapshot: NativeSnapshot) => void): () => void
}
declare global {
  interface Window {
    goodscrollBrowser?: NativeBrowser
  }
}
