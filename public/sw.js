const CACHE_NAME = "motormila-pwa-v1";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest"];
const STATIC_DESTINATIONS = new Set([
	"font",
	"image",
	"manifest",
	"script",
	"style",
	"worker",
]);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (url.pathname.startsWith("/api")) {
		event.respondWith(networkFirst(request));
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(fetch(request).catch(() => caches.match("/")));
		return;
	}

	if (isStaticAsset(request, url)) {
		event.respondWith(staleWhileRevalidate(request));
	}
});

function isStaticAsset(request, url) {
	return url.pathname.startsWith("/assets/") || STATIC_DESTINATIONS.has(request.destination);
}

async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);

	try {
		const response = await fetch(request);
		if (response.ok) {
			await cache.put(request, response.clone()).catch(() => undefined);
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	const fresh = fetch(request).then((response) => {
		if (response.ok) {
			cache.put(request, response.clone()).catch(() => undefined);
		}
		return response;
	});

	if (cached) {
		fresh.catch(() => undefined);
		return cached;
	}

	return fresh;
}
