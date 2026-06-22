import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { AppFooter } from "@/components/AppFooter";
import { Loader } from "@/components/Loader";
import { SettingsFloatingIcon } from "@/components/SettingsFloatingIcon";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { AuthProvider } from "@/lib/authContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AIChatWidget = lazy(() => import("@/components/AIChatWidget").then((m) => ({ default: m.AIChatWidget })));

// Lazy load heavy page chunks
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DealerDashboard = lazy(() => import("./pages/DealerDashboard"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Settings = lazy(() => import("./pages/Settings"));
const Trends = lazy(() => import("./pages/Trends"));
const Estimate = lazy(() => import("./pages/Estimate"));
const Calculator = lazy(() => import("./pages/Calculator"));
const EVHub = lazy(() => import("./pages/EVHub"));
const Blogs = lazy(() => import("./pages/Blogs"));
const BestPicks = lazy(() => import("./pages/BestPicks"));
const MapPage = lazy(() => import("./pages/MapPage"));
const SignIn = lazy(() => import("./pages/SignIn"));
const ProDashboard = lazy(() => import("./pages/ProDashboard"));
const ProPreview = lazy(() => import("./pages/ProPreview"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const ENTRY_SESSION_KEY = "autolens.has_entered";

function getSessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(key) === "1";
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const targetId = hash.replace("#", "");
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

const MinimalLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center" aria-label="Loading" role="status">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
        <div className="absolute inset-0 rounded-full border-t-2 border-amber-500 animate-spin" />
      </div>
      <p className="tech-label text-zinc-600">Loading</p>
    </div>
  </div>
);

function MainLayout({ chatMounted }: { chatMounted: boolean }) {
  return (
    <div className="min-h-screen app-shell selection:bg-primary/25 bg-[hsl(220,10%,3%)]">
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <Navbar />
      <ScrollToHash />
      <SettingsFloatingIcon />
      <FeedbackWidget />
      {chatMounted && (
        <Suspense fallback={null}>
          <AIChatWidget />
        </Suspense>
      )}
      <main id="main-content" className="relative z-[1] pt-[4rem]">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}

const App = () => {
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return getSessionFlag(ENTRY_SESSION_KEY);
  });
  const [chatMounted, setChatMounted] = useState(false);

  useEffect(() => {
    if (!hasEntered) return;
    const id = window.setTimeout(() => setChatMounted(true), 2000);
    return () => window.clearTimeout(id);
  }, [hasEntered]);

  const handleEnter = () => {
    setHasEntered(true);
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(ENTRY_SESSION_KEY, "1");
  };

  if (!hasEntered) {
    return <Loader onEnter={handleEnter} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <AppPreferencesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<MinimalLoader />}>
              <Routes>
                <Route element={<MainLayout chatMounted={chatMounted} />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dealer" element={<DealerDashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/trends" element={<Trends />} />
                  <Route path="/estimate" element={<Estimate />} />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route path="/blogs" element={<Blogs />} />
                  <Route path="/ev-hub" element={<EVHub />} />
                  <Route path="/best-picks" element={<BestPicks />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/listing/:id" element={<ListingDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/pro-preview" element={<ProPreview />} />
                <Route path="/pro" element={<ProtectedRoute><ProDashboard /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AppPreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
