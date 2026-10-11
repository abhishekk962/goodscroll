export function PageHeading({ title }: { title: string }) {
  return (
    <div className="px-5 pt-6 pb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  )
}
