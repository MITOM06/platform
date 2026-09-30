/**
 * Turn service base URLs into CSP source expressions.
 *
 * A CSP source that carries a path is matched against the *whole* path, not as
 * a prefix: CSP3 §6.6.2.10 requires a source path not ending in '/' to equal
 * the request URL's path exactly. So `https://api.example.com/api/auth` permits
 * precisely one URL and blocks every endpoint underneath it.
 *
 * That distinction was invisible while each service had its own host and no
 * path (Cloud Run). Serving all four from one host under `/api/<service>` (the
 * Mac mini behind Caddy) turned every base URL into a path-bearing source and
 * the browser refused every API call the app makes.
 *
 * Reducing each to its origin is both correct and no weaker in practice: the
 * services share an origin, so a path restriction here cannot separate them,
 * and CSP drops the path anyway once a request is redirected.
 *
 * Relative fallbacks ('/api/chat', used when the app is served from the same
 * origin as the API) are dropped — `'self'` already covers them.
 */
export function cspSources(urls: readonly string[]): string[] {
  const origins = urls.flatMap((url) => {
    if (!url?.startsWith('http')) return []
    try {
      const { origin } = new URL(url)
      // `new URL('http://')` throws, but other degenerate inputs can still
      // produce the opaque 'null' origin, which is not a usable source.
      return origin && origin !== 'null' ? [origin] : []
    } catch {
      return []
    }
  })
  return [...new Set(origins)]
}
