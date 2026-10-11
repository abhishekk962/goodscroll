import { projectInitials } from "@/lib/project-profile"
import { cn } from "@/lib/utils"

function projectColor(id: string) {
  // Generate the color from the ID rather than selecting from a fixed palette.
  let hash = 2166136261
  for (const character of id)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const hue = ((hash >>> 0) / 4294967296) * 360
  const saturation = 60 + ((hash >>> 8) % 11)
  // Keep white initials readable across the entire hue range.
  const lightness = 24 + ((hash >>> 16) % 5)
  return `hsl(${hue.toFixed(4)} ${saturation}% ${lightness}%)`
}

export function ProjectAvatar({
  project,
  className,
}: {
  project?: { id: string; worktree: string }
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: projectColor(project?.id ?? "account") }}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white",
        className
      )}
    >
      <span className="flex size-full items-center justify-center rounded-full text-xs font-semibold">
        {projectInitials(project)}
      </span>
    </span>
  )
}
