/* Bump the version when changing the offline shell or precached assets. */
const cachePrefix = "resource-directory-offline-";
const cacheName = `${cachePrefix}v1`;
const offlinePath = "/offline";
const icons = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

function shellAsset(value) {
  const url = new URL(value, self.location.origin);
  return url.origin === self.location.origin &&
    !url.search &&
    url.pathname.startsWith("/_next/static/") &&
    /\.(?:css|js|woff2?)$/.test(url.pathname)
    ? url.href
    : null;
}

async function precache() {
  const cache = await caches.open(cacheName);
  const response = await fetch(offlinePath, {
    cache: "reload",
    credentials: "omit",
    redirect: "error",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  ) {
    throw new Error("Offline page unavailable");
  }
  const html = await response.clone().text();
  // Only build assets referenced by this public, static page enter the shell cache.
  const assets = new Set(
    icons.map((path) => new URL(path, self.location.origin).href),
  );
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const asset = shellAsset(match[1]);
    if (asset) assets.add(asset);
  }
  for (const url of assets) {
    const asset = await fetch(url, {
      cache: "reload",
      credentials: "omit",
      redirect: "error",
    });
    if (!asset.ok) throw new Error("Offline asset unavailable");
    if (new URL(url).pathname.endsWith(".css")) {
      const css = await asset.clone().text();
      for (const match of css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) {
        const font = shellAsset(new URL(match[1], url).href);
        if (font && /\.woff2?$/.test(new URL(font).pathname)) assets.add(font);
      }
    }
    await cache.put(url, asset);
  }
  await cache.put(offlinePath, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Admin, invitations, APIs, RSC requests and writes never use an offline response.
  const publicPage =
    url.pathname === "/" ||
    url.pathname === offlinePath ||
    /^\/survey\/[^/]+\/?$/.test(url.pathname);
  if (request.mode === "navigate" && publicPage) {
    event.respondWith(
      fetch(request).catch(async () => {
        const fallback = await (
          await caches.open(cacheName)
        ).match(offlinePath);
        return fallback ?? Response.error();
      }),
    );
    return;
  }
  if (url.search || !(shellAsset(url.href) || icons.includes(url.pathname)))
    return;
  event.respondWith(
    (async () => {
      const cached = await (await caches.open(cacheName)).match(request);
      return cached ?? fetch(request);
    })(),
  );
});
