export function publicPosthogConfig() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim(),
    host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!token || !host || token.startsWith("phx_")) return null;
  try {
    const endpoint = new URL(host);
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== "/" ||
      ["us.posthog.com", "eu.posthog.com"].includes(endpoint.hostname) ||
      !(
        endpoint.protocol === "https:" ||
        (endpoint.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
      )
    )
      return null;
    return { token, host: endpoint.origin };
  } catch {
    return null;
  }
}
