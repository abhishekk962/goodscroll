import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MediaGrid } from "@/components/social/media-grid"
import { PersonAvatar } from "@/components/social/person-avatar"
import { friends, posts } from "@/data/social"

type ProfilePageProps = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return friends.map(({ id }) => ({ id }))
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { id } = await params
  const person = friends.find((friend) => friend.id === id)
  return { title: person?.name ?? "Profile not found" }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const person = friends.find((friend) => friend.id === id)
  if (!person) notFound()

  return (
    <section>
      <header className="flex items-center gap-4 px-5 py-6">
        <PersonAvatar person={person} className="size-16" />
        <div>
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <p className="text-sm text-muted-foreground">@{person.username}</p>
        </div>
      </header>
      <MediaGrid
        items={posts.filter((post) => post.author.id === person.id)}
        label={`${person.name}'s posts`}
      />
    </section>
  )
}
