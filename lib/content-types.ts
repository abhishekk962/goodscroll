export type Topic = {
  id: string
  title: string
  summary: string
  sources: string[]
}
export type FeedContent = {
  id: string
  topicID: string
  kind: "post" | "reel"
  title: string
  body: string
  slides: string[]
  seenAt: number | null
}
export type PostComment = {
  id: string
  body: string
  createdAt: number
}
export type PostFeedback = {
  liked: boolean
  commentCount: number
  comments: PostComment[]
}
export type FeedState = {
  items: FeedContent[]
  history: FeedContent[]
  topics: Topic[]
  running: boolean
  error: string | null
}
