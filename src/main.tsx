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
import "leaflet/dist/leaflet.css";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")!).render(
	<AppErrorBoundary>
		<App />
		<Analytics />
	</AppErrorBoundary>
);
