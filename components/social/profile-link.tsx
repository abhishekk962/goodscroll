import Link from "next/link"
import type { Person } from "@/data/social"
import { cn } from "@/lib/utils"

export function ProfileLink({
  person,
  children,
  className,
}: {
  person: Person
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={`/profiles/${person.id}`}
      aria-label={`${person.name}'s profile`}
      className={cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </Link>
  )
}
