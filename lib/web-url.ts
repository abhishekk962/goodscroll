export function publicWebURL(value: unknown) {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("Enter a public website URL.")
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !host.includes(".") ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.includes(":") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  )
    throw new Error(
      "Enter a public HTTP or HTTPS website URL without credentials."
    )
  return url.href
}
