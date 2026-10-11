"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { LoaderCircle, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageResponse } from "@/components/social/message-response"
import type {
  OpenCodeConversation,
  OpenCodeMessage,
  OpenCodeModel,
} from "@/lib/opencode"
import { cn } from "@/lib/utils"
import { readChatModel } from "@/lib/chat-model"

export function ConversationCard({
  conversation: initialConversation,
  project,
  models,
  modelStorageKey,
  legacyModelStorageKey,
}: {
  conversation: OpenCodeConversation
  project?: string
  models: OpenCodeModel[]
  modelStorageKey: string
  legacyModelStorageKey?: string
}) {
  const [conversation, setConversation] = useState(initialConversation)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string>()
  const [syncError, setSyncError] = useState<string>()
  const [pendingMessages, setPendingMessages] = useState<OpenCodeMessage[]>([])
  const [awaitingReply, setAwaitingReply] = useState<{
    messageID: string
    observedBusy: boolean
  }>()
  const [refresh, setRefresh] = useState(0)
  const sendingRef = useRef(false)
  const streamVersion = useRef(0)
  const streamConnected = useRef(false)
  const historyRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const followMessages = useRef(true)
  const endpoint = `/api/messages/${encodeURIComponent(initialConversation.id)}${
    project ? `?project=${encodeURIComponent(project)}` : ""
  }`
  const messages = [
    ...conversation.messages,
    ...pendingMessages.filter(
      (pending) =>
        !conversation.messages.some((message) => message.id === pending.id)
    ),
  ]
  const showTyping =
    Boolean(awaitingReply) ||
    (conversation.status !== "idle" && messages.at(-1)?.sender === "you")

  function reconcileReply(data: OpenCodeConversation) {
    setAwaitingReply((waiting) => {
      if (!waiting) return waiting
      const userIndex = data.messages.findIndex(
        (message) => message.id === waiting.messageID
      )
      if (
        userIndex >= 0 &&
        data.messages
          .slice(userIndex + 1)
          .some((message) => message.sender === "friend" && message.text)
      )
        return undefined
      if (data.status === "idle" && waiting.observedBusy) return undefined
      return data.status !== "idle"
        ? { ...waiting, observedBusy: true }
        : waiting
    })
  }

  useEffect(() => {
    const stream = new EventSource(
      `${endpoint}${endpoint.includes("?") ? "&" : "?"}stream=1`
    )
    stream.onopen = () => {
      streamConnected.current = true
    }
    stream.onerror = () => {
      streamConnected.current = false
    }
    stream.onmessage = (event) => {
      const data: OpenCodeConversation = JSON.parse(event.data)
      streamVersion.current += 1
      setConversation(data)
      reconcileReply(data)
      setPendingMessages((pending) =>
        pending.filter(
          (message) => !data.messages.some((item) => item.id === message.id)
        )
      )
      setSyncError(undefined)
    }
    return () => {
      streamConnected.current = false
      stream.close()
    }
  }, [endpoint])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function update() {
      if (streamConnected.current) {
        timer = setTimeout(update, 5000)
        return
      }
      let delay = 5000
      const version = streamVersion.current
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Could not refresh messages.")
        if (controller.signal.aborted) return
        if (!streamConnected.current && version === streamVersion.current) {
          setConversation(data)
          reconcileReply(data)
          setPendingMessages((pending) =>
            pending.filter(
              (message) =>
                !data.messages.some(
                  (item: OpenCodeMessage) => item.id === message.id
                )
            )
          )
        }
        setSyncError(undefined)
        delay = data.status === "idle" ? 5000 : 1000
      } catch (error) {
        if (controller.signal.aborted) return
        setSyncError(
          error instanceof Error ? error.message : "Could not refresh messages."
        )
      }
      if (!controller.signal.aborted) timer = setTimeout(update, delay)
    }
    void update()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [endpoint, refresh])

  useEffect(() => {
    const viewport = historyRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    if (!viewport) return
    const trackScroll = () => {
      followMessages.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80
    }
    viewport.addEventListener("scroll", trackScroll)
    return () => viewport.removeEventListener("scroll", trackScroll)
  }, [])

  useEffect(() => {
    const viewport = historyRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    if (viewport && followMessages.current)
      viewport.scrollTop = viewport.scrollHeight
  }, [conversation.messages, pendingMessages, showTyping])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError(undefined)
    // OpenCode sorts messages by their ID: its timestamp occupies the low
    // six bytes after reserving twelve bits for a sequence number.
    const timestamp = ((BigInt(Date.now()) << BigInt(12)) + BigInt(1))
      .toString(16)
      .slice(-12)
      .padStart(12, "0")
    const messageID = `msg_${timestamp}${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`
    setAwaitingReply({ messageID, observedBusy: false })
    setPendingMessages((pending) => [
      ...pending,
      { id: messageID, sender: "you", text, time: "" },
    ])
    setDraft("")
    followMessages.current = true
    const savedModel = readChatModel(modelStorageKey, legacyModelStorageKey)
    const model = models.find((item) => item.id === savedModel)?.id
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, model, messageID }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error ?? "Message could not be sent.")
      setRefresh((value) => value + 1)
    } catch (error) {
      setAwaitingReply(undefined)
      setPendingMessages((pending) =>
        pending.filter((message) => message.id !== messageID)
      )
      setDraft(text)
      setSendError(
        error instanceof Error
          ? error.message
          : "Message could not be sent. Please try again."
      )
    } finally {
      sendingRef.current = false
      setSending(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  return (
    <section
      aria-label={`Conversation with ${conversation.friend.name}`}
      className="min-h-0 flex-1"
    >
      <Card className="h-full gap-0 rounded-none bg-background py-0 shadow-none ring-0">
        <ScrollArea
          ref={historyRef}
          className="min-h-0 flex-1"
          aria-label="Message history"
        >
          <CardContent className="px-5 py-4">
            <ol className="space-y-3">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={cn(
                    "flex flex-col items-start",
                    message.sender === "you" && "items-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-full min-w-0 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed",
                      message.kind === "summary" &&
                        "border border-dashed border-primary/40 bg-primary/5 text-muted-foreground",
                      message.sender === "you" &&
                        "max-w-[85%] rounded-br-sm rounded-bl-2xl bg-primary text-primary-foreground"
                    )}
                  >
                    <span className="sr-only">
                      {message.sender === "you"
                        ? "You"
                        : conversation.friend.name}
                      :{" "}
                    </span>
                    {message.kind === "summary" && (
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-primary uppercase">
                        Session summary
                      </span>
                    )}
                    {message.sender === "you" && message.kind !== "summary" ? (
                      <p className="wrap-break-word whitespace-pre-wrap">
                        {message.text}
                      </p>
                    ) : (
                      <MessageResponse streaming={message.streaming}>
                        {message.text}
                      </MessageResponse>
                    )}
                  </div>
                  {message.time && (
                    <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                      {message.time}
                    </span>
                  )}
                </li>
              ))}
              {showTyping && (
                <li className="flex items-start">
                  <div
                    role="status"
                    aria-label="Agent is responding"
                    className="flex h-10 items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4"
                  >
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
                        style={{ animationDelay: `${dot * 150}ms` }}
                      />
                    ))}
                  </div>
                </li>
              )}
            </ol>
            {!messages.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Send a message to start this conversation.
              </p>
            )}
          </CardContent>
        </ScrollArea>
        <form
          onSubmit={send}
          className="shrink-0 space-y-2 border-t bg-background px-3 py-3"
        >
          {sendError && (
            <p role="alert" className="text-sm text-destructive">
              {sendError} Your draft is saved below.
            </p>
          )}
          {syncError && (
            <p role="status" className="text-xs text-muted-foreground">
              {syncError} Updates will retry automatically.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry now
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              aria-label="Message"
              placeholder="Write a message…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={32000}
              disabled={sending}
              rows={1}
              className="max-h-40 min-h-10 resize-none rounded-2xl"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <Button
              type="submit"
              size="icon-lg"
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="size-10 rounded-full"
            >
              {sending ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
