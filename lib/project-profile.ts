export const GLOBAL_PROJECT_ID = "global"

export function projectLabel(project?: { id: string; worktree: string }) {
  if (project?.id === GLOBAL_PROJECT_ID) return "Global chats"
  return project?.worktree.split(/[\\/]/).filter(Boolean).at(-1) ?? "Account"
}

export function projectInitials(project?: { id: string; worktree: string }) {
  if (project?.id === GLOBAL_PROJECT_ID) return "GC"
  const words = projectLabel(project)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  return (
    (words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
      : words[0]?.slice(0, 2)
    )?.toUpperCase() || "OC"
  )
}

export function chatModelKey(
  serverKey: string,
  projectID: string,
  sessionID: string
) {
  return `goodscroll:model:${serverKey}:${projectID}:${sessionID}`
}
