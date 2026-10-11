"use client"

import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"

export function MessageResponse({
  children,
  streaming = false,
}: {
  children: string
  streaming?: boolean
}) {
  return (
    <Streamdown
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      plugins={{ code }}
      className="min-w-0 space-y-3 wrap-break-word [&_pre]:text-xs [&_table]:text-xs"
    >
      {children}
    </Streamdown>
  )
}
