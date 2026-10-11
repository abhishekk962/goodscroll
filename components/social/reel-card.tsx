import Image from "next/image"
import { Heart, MessageCircle } from "lucide-react"
import { PersonAvatar } from "@/components/social/person-avatar"
import { ProfileLink } from "@/components/social/profile-link"
import type { Reel } from "@/data/social"

export function ReelCard({ reel }: { reel: Reel }) {
  return (
    <article
      aria-label={`Reel by ${reel.author.name}`}
      className="relative h-full snap-start snap-always overflow-hidden bg-black text-white"
    >
      <Image
        src={reel.image}
        alt={reel.alt}
        fill
        sizes="(max-width: 480px) 100vw, 480px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      <div className="absolute right-4 bottom-7 left-5 flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <ProfileLink person={reel.author} className="flex items-center gap-2">
            <PersonAvatar person={reel.author} className="size-9" />
            <p className="truncate text-sm font-semibold">
              {reel.author.username}
            </p>
          </ProfileLink>
          <p className="text-sm leading-relaxed">{reel.caption}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-5 text-xs">
          <span className="flex flex-col items-center gap-1">
            <Heart aria-hidden="true" className="size-6" />
            {reel.likes}
            <span className="sr-only"> likes</span>
          </span>
          <span className="flex flex-col items-center gap-1">
            <MessageCircle aria-hidden="true" className="size-6" />
            {reel.comments}
            <span className="sr-only"> comments</span>
          </span>
        </div>
      </div>
    </article>
  )
}
