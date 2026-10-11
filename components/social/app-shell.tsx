import { Navigation } from "@/components/social/navigation"
import { hasOpenCodeActivity, getOpenCodeSelection } from "@/lib/opencode"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { projects, project } = await getOpenCodeSelection()
  const projectID = project?.id
  const hasUnreadMessages = await hasOpenCodeActivity(projectID)
  return (
    <div className="relative mx-auto min-h-svh max-w-[480px] border-x border-border bg-background [--header-height:64px] [--nav-height:calc(76px+env(safe-area-inset-bottom))]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-2"
      >
        Skip to content
      </a>
      <main id="main-content" className="pb-[var(--nav-height)]">
        {children}
      </main>
      <Navigation
        projects={projects}
        projectID={projectID}
        hasUnreadMessages={hasUnreadMessages}
      />
    </div>
  )
}
