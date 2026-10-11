export function websiteURL(value, appOrigin) {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("Invalid website address")
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
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    url.origin === appOrigin
  )
    throw new Error("Use a public HTTP or HTTPS website address")
  return url.href
}

export function trustedAppURL(value, origin) {
  try {
    return new URL(value).origin === origin
  } catch {
    return false
  }
}
