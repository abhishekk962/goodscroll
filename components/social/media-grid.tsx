import Image from "next/image"
import { Clapperboard } from "lucide-react"
import type { MediaItem } from "@/data/social"

export function MediaGrid({
  items,
  label,
}: {
  items: MediaItem[]
  label: string
}) {
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative aspect-[3/4] overflow-hidden bg-muted"
        >
          <Image
            src={item.image}
            alt={item.alt}
            fill
            sizes="(max-width: 480px) 33vw, 160px"
            className="object-cover"
          />
          {item.kind === "reel" && (
            <span className="absolute top-2 right-2 rounded-md bg-black/40 p-1 text-white">
              <Clapperboard aria-hidden="true" className="size-4" />
              <span className="sr-only">Reel</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
