"use client"

import { useSyncExternalStore } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OpenCodeModel } from "@/lib/opencode"
import { readChatModel, saveChatModel } from "@/lib/chat-model"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener("goodscroll-model-change", callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener("goodscroll-model-change", callback)
  }
}

export function ModelSelector({
  models,
  currentModel,
  storageKey,
  projectModel,
  legacyStorageKey,
}: {
  models: OpenCodeModel[]
  storageKey: string
  currentModel?: string
  projectModel?: string
  legacyStorageKey?: string
}) {
  const savedModel = useSyncExternalStore(
    subscribe,
    () => readChatModel(storageKey, legacyStorageKey),
    () => null
  )
  const value =
    models.find((model) => model.id === savedModel)?.id ?? "__project__"
  const inheritedLabel =
    models.find((model) => model.id === projectModel)?.name ??
    (projectModel ? "Unavailable project model" : "OpenCode default")
  const providers = [...new Set(models.map((model) => model.provider))]

  return (
    <Select
      value={value}
      items={[
        { value: "__project__", label: "Project default" },
        ...models.map((model) => ({ value: model.id, label: model.name })),
      ]}
      onValueChange={(value) => {
        if (!value) return
        try {
          saveChatModel(
            storageKey,
            value === "__project__" ? null : value,
            legacyStorageKey
          )
        } catch {
          /* Storage may be unavailable in private browsing. */
        }
      }}
    >
      <SelectTrigger
        aria-label="Preferred model"
        title={`Chat override. Project default: ${inheritedLabel}.${currentModel ? ` Current response: ${currentModel}.` : ""}`}
        className="h-9 max-w-32 shrink-0 rounded-full text-xs sm:max-w-40"
      >
        <SelectValue
          placeholder={models.length ? "Select model" : "No models"}
          className="truncate"
        />
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="h-64 max-h-[min(16rem,var(--available-height))] w-72 max-w-[calc(100vw-2rem)]"
      >
        <SelectItem value="__project__">
          Use project default · {inheritedLabel}
        </SelectItem>
        {providers.map((provider) => (
          <SelectGroup key={provider}>
            <SelectLabel>{provider}</SelectLabel>
            {models
              .filter((model) => model.provider === provider)
              .map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
