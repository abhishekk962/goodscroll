import type { Metadata } from "next"
import { SearchBrowser } from "@/components/social/search-browser"

export const metadata: Metadata = { title: "Search" }

export default function SearchPage() {
  return <SearchBrowser />
}
