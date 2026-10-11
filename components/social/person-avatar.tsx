import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Person } from "@/data/social"
import { cn } from "@/lib/utils"

export function PersonAvatar({
  person,
  className,
}: {
  person: Person
  className?: string
}) {
  return (
    <Avatar className={cn("size-10", className)}>
      <AvatarImage src={person.avatar} alt={person.name} />
      <AvatarFallback>{person.initials}</AvatarFallback>
    </Avatar>
  )
}
