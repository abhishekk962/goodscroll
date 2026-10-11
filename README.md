# Goodscroll

Goodscroll turns your OpenCode project conversations into a social-style learning
feed, with educational carousels, animated text reels, project chats, and web search.
Built with Next.js, shadcn/ui, and an optional Electron desktop shell.

## Features

- **Project learning feed:** Extract topics from recent OpenCode conversations and
  turn them into educational carousel posts with 3–6 slides and short captions.
- **Animated text reels:** Learn through short text sequences with playback
  controls and readable transcripts.
- **Project chats:** Open and continue OpenCode conversations, with a project
  default model or a model override for each chat.
- **Project accounts:** Switch between projects and global chats, add repositories,
  and browse working folders within the selected project.
- **Personalized learning:** Like and comment on generated posts to guide future
  batches, with an option to disable feedback-based personalization.
- **Generation controls:** Choose the generation model, learning depth, and recent
  conversation window, or pause automatic generation.
- **Generation insights:** Inspect pipeline status, extracted topics, source chats,
  feedback, and the settings, inputs, results, and errors from recent runs.
- **Web search and reading:** Search with Nimble, read extracted pages, and revisit
  recent sites through saved previews.
- **Desktop browsing:** Open live websites in the Electron app with address
  navigation, back/forward, reload, and locally captured page screenshots.
- **Persistent local content:** Store generated topics, posts, reels, and feedback
  in SQLite, scoped to the OpenCode server and project. Feeds replenish as you read.
- **Appearance settings:** Configure the app's appearance alongside connection,
  authentication, timeout, and project preferences.

## Screenshots

<table>
  <tr>
    <th>Learning feed</th>
    <th>Project accounts</th>
  </tr>
  <tr>
    <td><img src="public/Screenshot%202026-10-11%20170221.png" alt="Generated educational carousel in the Goodscroll learning feed" width="280"></td>
    <td><img src="public/Screenshot%202026-10-11%20170250.png" alt="Project account switcher and project settings" width="280"></td>
  </tr>
  <tr>
    <th>Working folder picker</th>
    <th>Chat and model selection</th>
  </tr>
  <tr>
    <td><img src="public/Screenshot%202026-10-11%20170305.png" alt="Folder browser for choosing a project's working folder" width="280"></td>
    <td><img src="public/Screenshot%202026-10-11%20170355.png" alt="OpenCode project conversation with the chat model selector open" width="280"></td>
  </tr>
  <tr>
    <th>Search and recent sites</th>
    <th>Reader view</th>
  </tr>
  <tr>
    <td><img src="public/Screenshot%202026-10-11%20170407.png" alt="Web search and recent website previews" width="280"></td>
    <td><img src="public/Screenshot%202026-10-11%20170429.png" alt="Extracted web page displayed in the Reader view" width="280"></td>
  </tr>
  <tr>
    <th colspan="2">Animated text reels</th>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="public/Screenshot%202026-10-11%20170439.png" alt="AI-generated educational text reel with playback controls and transcript" width="280"></td>
  </tr>
</table>

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

**Content generation** on Profile configures the model used for topic extraction,
posts, and reels across every project and browser using this installation.
These settings live in SQLite, independently of chat model preferences. Choose
a connected text-generation model or Automatic, pause automatic generation,
set a 1–12 conversation source window, choose beginner/balanced/advanced learning
depth, and enable or disable personalization from likes and comments. Changes
apply to the next run; an active run keeps its settings. Disabling personalization
preserves feedback while excluding it from future model inputs. Reducing the
source window does not delete already extracted topics.

The **Content generation insights** link opens `/generation` for the selected
project. It shows pipeline status, configured and resolved models, stored data
counts, topics and source links, saved feedback, and the latest ten run snapshots.
Snapshots retain the actual bounded conversation excerpts and content-agent input
locally, including settings, selected topic summaries, feedback, previous titles,
results counts, and errors. Inputs are sent to the selected provider through
OpenCode. The page identifies skipped extraction and interrupted runs and never
starts generation itself. Refresh to update its data. Snapshots are scoped to the
OpenCode server and project; generation settings apply to the whole installation.

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
configuration API. These custom agents use the app-wide generation model (or
an automatically selected text model), with tools disabled. Registration adds the two agent
definitions to the project's OpenCode configuration. It requires a connected
OpenCode server and a configured model provider.

Goodscroll verifies that registered agents actually appear in OpenCode's agent
list. OpenCode 1.18.2 writes SDK project configuration to an ignored `config.json`;
on affected servers, Goodscroll runs each custom system prompt through the built-in
agent with tools disabled. Generation uses the explicit app-wide generation model when set;
otherwise it prefers a text-capable model from recent project conversations,
then a connected text-capable provider default. Transcription and embedding
models are excluded. Failures now retain the stage and underlying error message.

The topic agent reads the configured number of recent root conversations (up to 12) in the selected project,
with bounded text context. Topics retain source conversation IDs. A transcript
hash avoids repeated extraction when conversations have not changed. The content
agent turns stored topics into Instagram-style educational carousel posts with
3–6 slides and short captions, and animated text reels with playback controls
and readable transcripts. Existing text-only posts remain readable. These reels are text
sequences, not encoded video files. Home and Reels now use this content; the
Saved and sample profile screens still use their existing demo data.

## Web search and browser

Search uses Nimble Search for live results. Set `NIMBLE_API_KEY` in `.env.local`
and restart the server. The key stays on the server.

Run `pnpm desktop:dev` to open the Electron desktop app. It connects to an
existing Goodscroll dev server on port 3000, or starts one if none is available.
Run `pnpm desktop` to build and launch a production server plus the desktop app.
Closing the desktop window stops any server that its launcher started. Set
`GOODSCROLL_APP_URL=http://localhost:3000/search` to connect to a specific local
Goodscroll server. This is a source-run desktop shell, not a packaged installer.

In the desktop app, results open in one dedicated Chromium WebContentsView.
The website is loaded as a browser page, so iframe embedding restrictions do
not apply. Address navigation, links, redirects, back/forward, and reload are
handled by the native browser. Remote websites run sandboxed without Node.js
or the app's preload/IPC bridge, and use a separate persistent cookie partition.
Website permissions, downloads, local URLs, and navigation into the app are
blocked. Browser cookies persist in Electron's local user-data directory.

In a regular web browser, results open in the Nimble-powered Reader view.
The Live page button is available only in the desktop shell. There are no
third-party iframes or silent blank-page fallbacks.

Opening a page records it in Recently visited. Desktop navigation also tracks
links clicked inside websites and saves actual viewport screenshots after page
loading and on close. These previews can reflect the current login and scroll
state and are stored locally; native screenshots are never sent to Nimble.
Reader content and web-only previews are fetched through Nimble Extract.
The grid displays saved images, never live browser instances.
The most recent 50 distinct URLs are retained per browser cookie in the local
SQLite database. Existing reader previews are reused; Refresh recaptures them.
Search and reader extraction consume Nimble API usage; native screenshots do not.
Capture failures preserve history
and do not prevent live browsing.

Run `pnpm build` then `node tests/web-search.integration.mjs` to check search,
history isolation, saved PNG delivery, snapshot caching, and failure handling
against a mock Nimble service without paid API calls. Run `pnpm test:desktop`
to briefly open a fixture window and test native rendering of a site with
`X-Frame-Options: DENY`, link navigation, back/forward, screenshots, IPC isolation,
and cleanup. It takes no focus and makes no paid API calls.

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
