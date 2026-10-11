# Next.js template

This is a Next.js template with shadcn/ui.

## Accounts and settings

The bottom account avatar opens `/profile`. Each OpenCode project is an account;
switching accounts stays on this page. **Add project** opens a repository on the
configured server. **Change working folder** accepts folders belonging to the
selected project and remembers the choice when switching away and back.

**App settings** apply to all projects in this browser: OpenCode server URL,
optional server authentication, request timeout, and appearance. The initial URL
uses `OPENCODE_SERVER_URL`, falling back to `http://127.0.0.1:4096`. **Test
connection** tests the entered settings without saving them. The URL must be
reachable from the Goodscroll server.

**Project settings** contain the working folder and default model. A chat can
override that model or choose **Use project default**. With no project default,
OpenCode chooses the model. These preferences belong to Goodscroll; they do not
modify the OpenCode server's configuration files.

Connection, project preferences, and the selected account are saved in persistent
HTTP-only browser cookies. Chat model overrides and appearance use browser local
storage. Project preferences and chat overrides are scoped to the server URL;
changing servers preserves the previous server's settings. Other browsers have
independent settings.

To check the account flows, start the dev server and run:

```bash
node tests/account-settings.integration.mjs
```

The integration check uses mock OpenCode servers and isolated cookie jars. Set
`GOODSCROLL_TEST_URL` to test a Goodscroll server on a different port.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Project learning feed

Use Node.js 22.13 or newer (Node 24 recommended). SQLite is supplied by Node;
no database service or additional dependency is required. The app creates
`.goodscroll/content.sqlite` on first feed access. Set `GOODSCROLL_DB_PATH` to
use another persistent local file. Database files are excluded from Git.

Open Home or Reels with an OpenCode project selected. Goodscroll registers
`goodscroll-topics` and `goodscroll-content` through the directory-scoped SDK
configuration API. These custom agents use the project's chosen model (or
OpenCode's default), with tools disabled. Registration adds the two agent
definitions to the project's OpenCode configuration. It requires a connected
OpenCode server and a configured model provider.

Goodscroll verifies that registered agents actually appear in OpenCode's agent
list. OpenCode 1.18.2 writes SDK project configuration to an ignored `config.json`;
on affected servers, Goodscroll runs each custom system prompt through the built-in
agent with tools disabled. Generation uses the explicit project model when set;
otherwise it prefers a text-capable model from recent project conversations,
then a connected text-capable provider default. Transcription and embedding
models are excluded. Failures now retain the stage and underlying error message.

The topic agent reads up to 12 recent root conversations in the selected project,
with bounded text context. Topics retain source conversation IDs. A transcript
hash avoids repeated extraction when conversations have not changed. The content
agent turns stored topics into Instagram-style educational carousel posts with
3–6 slides and short captions, and animated text reels with playback controls
and readable transcripts. Existing text-only posts remain readable. These reels are text
sequences, not encoded video files. Home and Reels now use this content; the
Saved and sample profile screens still use their existing demo data.

## Web search and browser

Search uses Nimble Search for live results. Set `NIMBLE_API_KEY` in `.env.local`
and restart the server. The key stays on the server. Open a result to browse in
a single sandboxed iframe, or enter a URL in its address bar. Back and forward
move between pages opened through Goodscroll's controls. Websites that deny
embedding can be read with the Reader tab, populated by Nimble Extract.

Opening a page records it in Recently visited and captures a full-page PNG and
Markdown through Nimble Extract. The grid displays saved images, never iframes.
The most recent 50 distinct URLs are retained per browser cookie in the local
SQLite database. Existing previews are reused; Refresh recaptures them. Search
and snapshot capture consume Nimble API usage. Capture failures preserve history
and do not prevent live browsing.

Snapshots represent Nimble's public page capture, rather than the iframe's
logged-in or interacted-with state. Cross-origin browser restrictions prevent
Goodscroll from observing links clicked inside a third-party iframe; only URLs
opened from results, recent cards, and the address bar enter Goodscroll history.

Run `pnpm build` then `node tests/web-search.integration.mjs` to check search,
history isolation, saved PNG delivery, snapshot caching, and failure handling
against a mock Nimble service without paid API calls.

Topics, content, and seen timestamps are isolated by OpenCode server URL and
project ID. This is a local, single-user database: browsers connected to the same
Goodscroll installation share content, seen state, likes, and comments for that scope.
Posts support liking/unliking and comments of up to 1,000 characters. Feedback
is stored separately from generated content, survives restarts, and stays in its
project. Retrying a comment submission does not create a duplicate. The next
generation batch receives up to 30 recently engaged posts, with the latest five
comments per post, to adapt topic interest, examples, and depth. Likes are a soft
interest signal; comments are untrusted preference/question data. Feedback does
not discard or regenerate the current queue and is not copied into public posts.

A visible post is marked seen after 1.5 seconds; a reel after 3 seconds. Hidden
browser tabs do not count. Seen cards stay in the current scroll session and are
shown alongside the latest 20 seen items on the next visit so you can return to
recent posts and their comments. Only unseen items count toward replenishment.
Once either queue reaches two unseen items, the
content agent replenishes that queue toward six. SQLite leases prevent concurrent
generation, exact duplicates are rejected, outputs are validated, and failures
back off for one minute. The app checks for new conversations every five minutes
while a feed is open. Generation continues after its HTTP response via Next.js
`after`; the browser polls for results. It resumes after restart on the next feed
visit, or after an expired lease (10 minutes following an interrupted run).

Run locally with `pnpm dev`. Deployment requires a persistent writable filesystem
and a long-running Node server; ephemeral serverless storage is unsuitable for
this SQLite database. Generation runs on feed activity, so it does not run while
the app is closed.

To verify the pipeline without spending model credits:

```bash
pnpm build
node --test tests/content-integration.mjs
```

The test starts a production app on port 4319 and a mock OpenCode server, using
an isolated SQLite file under `.goodscroll`. Set `GOODSCROLL_TEST_PORT` if needed.
