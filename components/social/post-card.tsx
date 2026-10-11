import Image from "next/image"
import { Heart, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PersonAvatar } from "@/components/social/person-avatar"
import { ProfileLink } from "@/components/social/profile-link"
import type { Post } from "@/data/social"

export function PostCard({ post }: { post: Post }) {
  return (
    <article aria-label={`Post by ${post.author.name}`}>
      <Card className="gap-0 rounded-none bg-background py-0 ring-0">
        <CardHeader className="flex flex-row items-center gap-3 px-5 pb-3">
          <ProfileLink person={post.author}>
            <PersonAvatar person={post.author} />
          </ProfileLink>
          <div>
            <ProfileLink person={post.author} className="text-sm font-semibold">
              {post.author.username}
            </ProfileLink>
            <p className="mt-0.5 text-xs text-muted-foreground">{post.time}</p>
          </div>
        </CardHeader>
        <Image
          src={post.image}
          alt={post.alt}
          width={900}
          height={900}
          sizes="(max-width: 480px) 100vw, 480px"
          className="aspect-square w-full object-cover"
        />
        <CardContent className="space-y-2 border-b px-5 pt-3 pb-5">
          <div className="flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Heart aria-hidden="true" className="size-5" />
              {post.likes}
              <span className="sr-only"> likes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle aria-hidden="true" className="size-5" />
              {post.comments}
              <span className="sr-only"> comments</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed">{post.caption}</p>
        </CardContent>
      </Card>
    </article>
  )
}
