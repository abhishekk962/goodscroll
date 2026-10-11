export type Person = {
  id: string
  name: string
  username: string
  avatar: string
  initials: string
}

export type MediaItem = {
  id: string
  kind: "post" | "reel"
  image: string
  alt: string
}

export type Post = MediaItem & {
  author: Person
  caption: string
  time: string
  likes: string
  comments: string
}

export type Conversation = {
  id: string
  friend: Person
  date: string
  unread: boolean
  messages: {
    id: string
    sender: "friend" | "you"
    text: string
    time: string
  }[]
}

export type Reel = MediaItem & {
  author: Person
  caption: string
  likes: string
  comments: string
}

export type Story = {
  id: string
  friend: Person
  seen: boolean
  reelId: string
}

const placeholder = (size: string, background: string, text: string) =>
  `https://placehold.co/${size}/${background}/e5e5e5.png?text=${encodeURIComponent(text)}`

export const friends: Person[] = [
  {
    id: "maya",
    name: "Maya Chen",
    username: "maya.chen",
    initials: "MC",
    avatar: placeholder("96x96", "394c45", "MC"),
  },
  {
    id: "alex",
    name: "Alex Rivera",
    username: "alex.rivera",
    initials: "AR",
    avatar: placeholder("96x96", "484052", "AR"),
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    username: "jordan.lee",
    initials: "JL",
    avatar: placeholder("96x96", "50463b", "JL"),
  },
]

export const stories: Story[] = [
  { id: "story-1", friend: friends[0], seen: false, reelId: "reel-2" },
  { id: "story-2", friend: friends[1], seen: false, reelId: "reel-1" },
  { id: "story-3", friend: friends[2], seen: true, reelId: "reel-3" },
]

export const posts: Post[] = [
  {
    id: "post-1",
    kind: "post",
    author: friends[0],
    image: placeholder("900x900", "394c45", "Post 01"),
    alt: "Placeholder for Maya's post",
    caption: "A little moment from today.",
    time: "2 hours ago",
    likes: "128",
    comments: "12",
  },
  {
    id: "post-2",
    kind: "post",
    author: friends[1],
    image: placeholder("900x900", "484052", "Post 02"),
    alt: "Placeholder for Alex's post",
    caption: "Taking the scenic route.",
    time: "4 hours ago",
    likes: "86",
    comments: "5",
  },
  {
    id: "post-3",
    kind: "post",
    author: friends[2],
    image: placeholder("900x900", "50463b", "Post 03"),
    alt: "Placeholder for Jordan's post",
    caption: "Some things are worth slowing down for.",
    time: "6 hours ago",
    likes: "204",
    comments: "18",
  },
]

export const reels: Reel[] = [
  {
    id: "reel-1",
    kind: "reel",
    author: friends[1],
    image: placeholder("720x1280", "313c4a", "Reel 01"),
    alt: "Placeholder for Alex's reel",
    caption: "A few seconds from my day.",
    likes: "324",
    comments: "16",
  },
  {
    id: "reel-2",
    kind: "reel",
    author: friends[0],
    image: placeholder("720x1280", "4c3c42", "Reel 02"),
    alt: "Placeholder for Maya's reel",
    caption: "The little things.",
    likes: "218",
    comments: "9",
  },
  {
    id: "reel-3",
    kind: "reel",
    author: friends[2],
    image: placeholder("720x1280", "424c3c", "Reel 03"),
    alt: "Placeholder for Jordan's reel",
    caption: "One moment at a time.",
    likes: "176",
    comments: "7",
  },
]

export const savedItems: MediaItem[] = [
  posts[0],
  reels[0],
  posts[1],
  reels[1],
  posts[2],
  reels[2],
]
export const previousSearchResults: MediaItem[] = [
  reels[2],
  posts[1],
  reels[0],
  posts[2],
  reels[1],
  posts[0],
]

export const conversations: Conversation[] = [
  {
    id: "chat-1",
    friend: friends[0],
    date: "Today",
    unread: true,
    messages: [
      {
        id: "m1",
        sender: "friend",
        text: "Hey! How's your day going?",
        time: "10:24 AM",
      },
      {
        id: "m2",
        sender: "you",
        text: "Pretty good. Just taking a little break.",
        time: "10:26 AM",
      },
      {
        id: "m3",
        sender: "friend",
        text: "Sounds like a good idea!",
        time: "10:27 AM",
      },
    ],
  },
  {
    id: "chat-2",
    friend: friends[1],
    date: "Yesterday",
    unread: false,
    messages: [
      {
        id: "m4",
        sender: "friend",
        text: "Have you seen the photos I posted?",
        time: "4:12 PM",
      },
      {
        id: "m5",
        sender: "you",
        text: "Yes! Love those colors.",
        time: "4:18 PM",
      },
    ],
  },
  {
    id: "chat-3",
    friend: friends[2],
    date: "Yesterday",
    unread: true,
    messages: [
      {
        id: "m6",
        sender: "you",
        text: "Hope you had a nice weekend.",
        time: "6:30 PM",
      },
      {
        id: "m7",
        sender: "friend",
        text: "I did, thank you! You too.",
        time: "6:42 PM",
      },
    ],
  },
]
