const CACHE_NAME = "chieflane-shell-v3";
const PUBLIC_ASSETS = [
  "/login",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSurfaceApi =
    url.origin === self.location.origin && url.pathname.startsWith("/api/surfaces");
  const isNavigation = request.mode === "navigate";

  if (!isNavigation && !isSurfaceApi) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cacheScope = response.headers.get("x-chieflane-cache-scope");
        const requestUrl = new URL(request.url);
        const responseUrl = new URL(response.url);
        const isRedirectedResponse =
          response.redirected ||
          responseUrl.origin !== requestUrl.origin ||
          responseUrl.pathname !== requestUrl.pathname ||
          responseUrl.search !== requestUrl.search;

        if (response.ok && cacheScope !== "private" && !isRedirectedResponse) {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        return caches.match("/login");
      })
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Chieflane";
  const options = {
    body: payload.body || "A surface needs your attention.",
    data: { url: payload.url || "/today" },
    badge: "/icons/icon-192.svg",
    icon: "/icons/icon-192.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/today";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
