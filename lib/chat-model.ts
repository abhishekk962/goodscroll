export function readChatModel(storageKey: string, legacyKey?: string) {
  try {
    return (
      localStorage.getItem(storageKey) ??
      (legacyKey ? localStorage.getItem(legacyKey) : null)
    )
  } catch {
    return null
  }
}

export function saveChatModel(
  storageKey: string,
  model: string | null,
  legacyKey?: string
) {
  if (model) localStorage.setItem(storageKey, model)
  else localStorage.removeItem(storageKey)
  // Once edited, the old preference must not override an inherited default.
  if (legacyKey) localStorage.removeItem(legacyKey)
  window.dispatchEvent(new Event("goodscroll-model-change"))
}
