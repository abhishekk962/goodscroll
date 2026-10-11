"use client"

import { useEffect, useRef } from "react"
import type { NativeBrowser } from "@/lib/native-browser"

export function NativePage({ browser }: { browser: NativeBrowser }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const target = element.current
    if (!target) return
    const update = () => {
      const rect = target.getBoundingClientRect()
      void browser
        .layout(
          { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          !document.hidden
        )
        .catch(() => {})
    }
    const observer = new ResizeObserver(update)
    observer.observe(target)
    window.addEventListener("resize", update)
    document.addEventListener("visibilitychange", update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
      document.removeEventListener("visibilitychange", update)
      void browser
        .layout({ x: 0, y: 0, width: 0, height: 0 }, false)
        .catch(() => {})
    }
  }, [browser])
  return (
    <div
      ref={element}
      className="min-h-0 w-full flex-1 bg-white"
      aria-label="Native website browser"
    />
  )
}
