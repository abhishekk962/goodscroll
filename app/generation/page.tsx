import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Database, Sparkles } from "lucide-react"
import { preparePipeline } from "@/lib/content-pipeline"
import { generationInsights } from "@/lib/local-database"
import { projectLabel } from "@/lib/project-profile"
import { getOpenCodeSelection } from "@/lib/opencode"
import { RefreshGenerationInsights } from "@/components/social/generation-settings"
import type { GenerationRun } from "@/lib/generation-types"

export const metadata: Metadata = { title: "Content generation insights" }

function when(value: number | null) {
  return value
    ? new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "Not yet"
}
function RunDetails({
  run,
  projectID,
}: {
  run: GenerationRun
  projectID: string
}) {
  const query = `?project=${encodeURIComponent(projectID)}`
  return (
    <article className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{when(run.startedAt)}</p>
        <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
          {run.status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {run.stage} · {run.model ?? "No model needed or resolved yet"}
      </p>
      {run.error && (
        <p role="alert" className="text-sm text-destructive">
          {run.error}
        </p>
      )}
      {run.status === "interrupted" && (
        <p className="text-sm text-muted-foreground">
          This run lost its generation lease before finishing. The next feed
          visit can retry.
        </p>
      )}
      <p className="text-sm">
        {run.data.generatedCounts
          ? `${run.data.generatedCounts.post} posts and ${run.data.generatedCounts.reel} reels generated`
          : "No new content saved in this run."}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Source conversations checked ({run.data.sources.length})
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {run.data.topicExtraction
              ? "These bounded message excerpts were prepared for the topic extraction attempt."
              : "These sources were checked. Topic extraction was skipped or had not started; these excerpts were not sent to the topic agent in this run."}
          </p>
          {run.data.sources.map((source) => (
            <div key={source.id} className="space-y-2 border-t pt-3">
              <Link
                href={`/messages/${encodeURIComponent(source.id)}${query}`}
                className="text-sm font-semibold underline"
              >
                {source.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Updated {when(source.updatedAt)}
              </p>
              {source.messages.map((message, index) => (
                <details key={index}>
                  <summary className="cursor-pointer text-xs capitalize">
                    {message.role} excerpt · {message.text.length} characters
                  </summary>
                  <p className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
                    {message.text}
                  </p>
                </details>
              ))}
            </div>
          ))}
          {!run.data.sources.length && (
            <p className="text-sm text-muted-foreground">
              No eligible conversation excerpts recorded.
            </p>
          )}
        </div>
      </details>
      {run.data.contentInput && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Content generation input
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              {run.data.contentInput.topics.length} topics ·{" "}
              {run.data.contentInput.feedback.length} feedback posts ·{" "}
              {run.data.contentInput.previous.length} previous titles
            </p>
            <p>
              Learning depth: {run.data.settings.depth}. Feedback:{" "}
              {run.data.settings.useFeedback
                ? "included when available"
                : "disabled"}
              .
            </p>
            <p className="text-xs text-muted-foreground">
              This is the saved input prepared for this run, including topic
              summaries, source IDs, feedback excerpts, and titles used to avoid
              repeats.
            </p>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs break-words whitespace-pre-wrap">
              {JSON.stringify(run.data.contentInput, null, 2)}
            </pre>
          </div>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Settings for this run
        </summary>
        <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(run.data.settings, null, 2)}
        </pre>
      </details>
    </article>
  )
}

export default async function GenerationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectID } = await searchParams
  const selection = await getOpenCodeSelection(projectID)
  let insights: ReturnType<typeof generationInsights> | null = null
  let error = selection.error
  if (selection.project) {
    try {
      const context = await preparePipeline(selection.project.id)
      insights = generationInsights(context.scope)
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : "Could not load generation insights."
    }
  }
  const query = selection.project
    ? `?project=${encodeURIComponent(selection.project.id)}`
    : ""
  return (
    <section>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/profile${query}#generation-settings`}
            aria-label="Back to generation settings"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-semibold">Generation insights</h1>
        </div>
        <RefreshGenerationInsights />
      </header>
      <div className="space-y-6 px-5 py-6">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground">
            CONTENT & DATA
          </p>
          <h2 className="mt-2 text-2xl font-semibold">What shapes your feed</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Explore the topics, conversations, and feedback behind{" "}
            {projectLabel(selection.project)}. Viewing this page does not start
            generation.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!selection.project && (
          <Link href="/profile" className="text-sm underline">
            Connect and choose a project in Profile.
          </Link>
        )}
        {insights && (
          <>
            <section
              aria-labelledby="pipeline-status"
              className="space-y-3 rounded-2xl border p-4"
            >
              <h2
                id="pipeline-status"
                className="flex items-center gap-2 font-semibold"
              >
                <Sparkles className="size-4" />
                Generation status
              </h2>
              <p className="text-sm">
                {insights.running
                  ? "A generation run is active"
                  : insights.settings.enabled
                    ? "Ready · runs on feed activity"
                    : "Paused"}
              </p>
              <p className="text-sm break-words">
                Configured model:{" "}
                <span className="font-medium">
                  {insights.settings.model ?? "Automatic text model"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Last checked: {when(insights.checkedAt)}
                {insights.error
                  ? ` · Retry after ${when(insights.retryAt)}`
                  : ""}
              </p>
              {insights.error && (
                <p role="alert" className="text-sm text-destructive">
                  {insights.error}
                </p>
              )}
              <Link
                href={`/profile${query}#generation-settings`}
                className="text-sm font-medium underline"
              >
                Edit app-wide generation settings
              </Link>
            </section>
            <section
              aria-label="Stored data counts"
              className="grid grid-cols-3 gap-3"
            >
              {Object.entries(insights.stats).map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {label}
                  </p>
                </div>
              ))}
            </section>
            <section
              aria-labelledby="generation-data"
              className="space-y-3 rounded-2xl border p-4"
            >
              <h2
                id="generation-data"
                className="flex items-center gap-2 font-semibold"
              >
                <Database className="size-4" />
                How your data is used
              </h2>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                <li>
                  Topic extraction checks up to {insights.settings.sourceLimit}{" "}
                  recent root conversations in this project. Child and internal
                  generation sessions are excluded.
                </li>
                <li>
                  Each source reads up to 30 recent messages and keeps up to 20
                  nonempty excerpts, capped at 2,000 characters per message and
                  60,000 characters total. User text and completed assistant
                  responses are eligible.
                </li>
                <li>
                  Content generation uses up to 40 stored topics, their
                  summaries and source IDs, and the latest 60 post/reel titles
                  to avoid repeats.
                </li>
                <li>
                  {insights.settings.useFeedback
                    ? "Personalization includes up to 30 recently engaged posts, each with its like state, a 600-character caption excerpt, and its five latest comments."
                    : "Personalization is off. Saved likes and comments are excluded from new generation inputs."}
                </li>
                <li>
                  Seen timestamps control replenishment. Each queue is filled
                  toward six when two unseen items remain. Open feeds check for
                  new conversations every five minutes.
                </li>
              </ul>
              <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                Inputs are sent to the selected model through your OpenCode
                server. Source excerpts and input snapshots for the ten latest
                runs per project are retained in this installation’s local
                database and shared across its browsers. Models are instructed
                to generalize private discussions and omit secrets from
                generated posts.
              </p>
            </section>
            <section aria-labelledby="generation-topics" className="space-y-3">
              <h2 id="generation-topics" className="font-semibold">
                Stored topics available to generation
              </h2>
              <p className="text-xs text-muted-foreground">
                Latest {insights.topics.length} of {insights.stats.topics}{" "}
                stored topics. Sources link to the original conversations.
              </p>
              {insights.topics.map((topic) => (
                <details key={topic.id} className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {topic.title}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed">
                    {topic.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topic.sources.map((id) => (
                      <Link
                        key={id}
                        href={`/messages/${encodeURIComponent(id)}${query}`}
                        className="rounded-full bg-muted px-2 py-1 text-xs underline"
                      >
                        {id}
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
              {!insights.topics.length && (
                <p className="text-sm text-muted-foreground">
                  No topics stored yet. Open your feed after starting a project
                  conversation.
                </p>
              )}
            </section>
            <section
              aria-labelledby="generation-feedback"
              className="space-y-3"
            >
              <h2 id="generation-feedback" className="font-semibold">
                Feedback available for future posts
              </h2>
              <p className="text-xs text-muted-foreground">
                {insights.settings.useFeedback
                  ? "Recent engagement that can shape the next batch."
                  : "Saved engagement; excluded while personalization is off."}
              </p>
              {insights.feedback.map((post, index) => (
                <details
                  key={`${post.topicID}:${index}`}
                  className="rounded-xl border p-3"
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    {post.liked ? "♥ " : ""}
                    {post.title} · {post.comments.length} recent comments
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                  {post.comments.map((comment, index) => (
                    <p
                      key={index}
                      className="mt-3 border-t pt-3 text-sm break-words whitespace-pre-wrap"
                    >
                      <span className="mr-2 font-semibold">You</span>
                      {comment}
                    </p>
                  ))}
                </details>
              ))}
              {!insights.feedback.length && (
                <p className="text-sm text-muted-foreground">
                  Like or comment on a post to add feedback.
                </p>
              )}
            </section>
            <section aria-labelledby="generation-runs" className="space-y-3">
              <h2 id="generation-runs" className="font-semibold">
                Recent generation runs
              </h2>
              <p className="text-xs text-muted-foreground">
                The ten latest runs with the settings and bounded inputs used at
                the time. Earlier runs made before insights were added have no
                snapshots.
              </p>
              {insights.runs.map((run) => (
                <RunDetails
                  key={run.id}
                  run={run}
                  projectID={selection.project!.id}
                />
              ))}
              {!insights.runs.length && (
                <p className="text-sm text-muted-foreground">
                  No recorded runs yet. Open the feed to start an eligible
                  generation run.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  )
}
