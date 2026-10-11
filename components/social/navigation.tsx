"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Bookmark,
  Clapperboard,
  House,
  MessageCircle,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProjectAvatar } from "@/components/social/project-avatar"
import { projectLabel } from "@/lib/project-profile"
import type { OpenCodeProject } from "@/lib/opencode"

const destinations = [
  { href: "/", label: "Home", icon: House },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/search", label: "Search", icon: Search },
  { href: "/reels", label: "Reels", icon: Clapperboard },
]

export function Navigation({
  hasUnreadMessages,
  projects,
  projectID,
}: {
  hasUnreadMessages: boolean
  projects: OpenCodeProject[]
  projectID?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedID = searchParams.get("project") ?? projectID
  const project = selectedID
    ? projects.find((item) => item.id === selectedID)
    : projects[0]
  const profileHref = selectedID
    ? `/profile?project=${encodeURIComponent(selectedID)}`
    : "/profile"

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[var(--nav-height)] max-w-[480px] grid-cols-6 items-start border-t bg-background/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      {destinations.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
        const unread =
          href === "/messages" && selectedID === projectID && hasUnreadMessages
        return (
          <Button
            key={href}
            render={
              <Link
                href={
                  selectedID
                    ? `${href}?project=${encodeURIComponent(selectedID)}`
                    : href
                }
              />
            }
            nativeButton={false}
            variant="ghost"
            aria-label={unread ? `${label}, unread messages` : label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "h-14 rounded-xl px-0 text-muted-foreground",
              active && "bg-muted text-foreground"
            )}
          >
            <span className="relative">
              <Icon
                aria-hidden="true"
                className="size-[22px]"
                strokeWidth={active ? 2.2 : 1.7}
              />
              {unread && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-background"
                />
              )}
            </span>
          </Button>
        )
      })}
      <div className="flex h-14 items-center justify-center">
        <Button
          render={<Link href={profileHref} />}
          nativeButton={false}
          variant="ghost"
          aria-label={`Account: ${projectLabel(project)}`}
          aria-current={pathname === "/profile" ? "page" : undefined}
          className="size-11 rounded-full p-1"
        >
          <ProjectAvatar
            project={project}
            className={cn(
              "size-8",
              pathname === "/profile" &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-background"
            )}
          />
        </Button>
      </div>
    </nav>
  )
}
