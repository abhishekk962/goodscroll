import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Database, Sparkles } from "lucide-react"
import { preparePipeline } from "@/lib/content-pipeline"
import { generationInsights } from "@/lib/local-database"
import { projectLabel } from "@/lib/project-profile"
import { getOpenCodeSelection } from "@/lib/opencode"
import { RefreshGenerationInsights } from "@/components/social/generation-settings"
import type { GenerationRun } from "@/lib/generation-types"

export const metadata: Metadata = { title: "Generation insights" }

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
        {run.stage} · {run.model ?? "No model selected"}
      </p>
      {run.error && (
        <p role="alert" className="text-sm text-destructive">
          {run.error}
        </p>
      )}
      {run.status === "interrupted" && (
        <p className="text-sm text-muted-foreground">
          Run interrupted. Reopen the feed to retry.
        </p>
      )}
      <p className="text-sm">
        {run.data.generatedCounts
          ? `${run.data.generatedCounts.post} posts and ${run.data.generatedCounts.reel} reels generated`
          : "No new content saved."}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Source chats ({run.data.sources.length})
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {run.data.topicExtraction
              ? "Excerpts prepared for topic extraction."
              : "Sources checked; excerpts were not sent for topic extraction."}
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
              No eligible excerpts.
            </p>
          )}
        </div>
      </details>
      {run.data.contentInput && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Generation input
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
              Saved topics, sources, feedback, and titles used to avoid repeats.
            </p>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs break-words whitespace-pre-wrap">
              {JSON.stringify(run.data.contentInput, null, 2)}
            </pre>
          </div>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Run settings
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
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Topics, chats, and feedback shaping{" "}
            {projectLabel(selection.project)}.
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
            Choose a project in Profile.
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
                  ? "Generating"
                  : insights.settings.enabled
                    ? "Ready · runs on feed activity"
                    : "Paused"}
              </p>
              <p className="text-sm break-words">
                Model:{" "}
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
                Edit settings
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
                  Topics use up to {insights.settings.sourceLimit} recent
                  top-level chats. Child and generation sessions are excluded.
                </li>
                <li>
                  Each chat contributes up to 20 excerpts from 30 recent
                  messages: user text and completed assistant responses. Limits:
                  2,000 characters per message, 60,000 total.
                </li>
                <li>
                  Generation uses up to 40 topics with summaries and source IDs,
                  plus 60 recent titles to avoid repeats.
                </li>
                <li>
                  {insights.settings.useFeedback
                    ? "Personalization uses up to 30 recently engaged posts: likes, 600-character caption excerpts, and five comments each."
                    : "Personalization is off; saved likes and comments aren’t used."}
                </li>
                <li>
                  Queues refill toward six when two unseen items remain. Open
                  feeds check for new chats every five minutes.
                </li>
              </ul>
              <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                Inputs go to the selected model through OpenCode. Excerpts and
                inputs for the last ten runs per project are stored locally and
                shared across this installation’s browsers. Models are
                instructed to generalize private discussions and omit secrets.
              </p>
            </section>
            <section aria-labelledby="generation-topics" className="space-y-3">
              <h2 id="generation-topics" className="font-semibold">
                Topics
              </h2>
              <p className="text-xs text-muted-foreground">
                Latest {insights.topics.length} of {insights.stats.topics}{" "}
                topics. Sources link to chats.
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
                  Start a project chat, then open the feed to extract topics.
                </p>
              )}
            </section>
            <section
              aria-labelledby="generation-feedback"
              className="space-y-3"
            >
              <h2 id="generation-feedback" className="font-semibold">
                Feedback
              </h2>
              <p className="text-xs text-muted-foreground">
                {insights.settings.useFeedback
                  ? "Used to personalize the next batch."
                  : "Saved; personalization is off."}
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
                Recent runs
              </h2>
              <p className="text-xs text-muted-foreground">
                Last ten runs with settings and inputs. Older runs may lack
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
                  No runs yet. Open the feed to generate content.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  )
}
