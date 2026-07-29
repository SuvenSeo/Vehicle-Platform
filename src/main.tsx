import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import "@fontsource/geist-mono/latin-600.css";
import "@fontsource/geist-mono/latin-700.css";
import "./index.css";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { Analytics } from "@vercel/analytics/react";

// Error tracking — dynamically imported so the bundle only pays for Sentry
// when VITE_SENTRY_DSN is configured at build time.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
	void import("@sentry/react").then((Sentry) => {
		Sentry.init({
			dsn: sentryDsn,
			environment: import.meta.env.MODE,
			sendDefaultPii: false,
		});
	});
}

createRoot(document.getElementById("root")!).render(
	<AppPreferencesProvider>
		<AppErrorBoundary>
			<App />
			<Analytics />
		</AppErrorBoundary>
	</AppPreferencesProvider>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register("/sw.js");
	});
}
