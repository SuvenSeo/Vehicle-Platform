import { MotionConfig } from "framer-motion";
import { Suspense, useState, useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AppFooter } from "@/components/AppFooter";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { RouteMeta } from "@/components/RouteMeta";
import { SettingsFloatingIcon } from "@/components/SettingsFloatingIcon";
import { AuthProvider } from "@/lib/authContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { QUERY_STALE } from "@/lib/queryPolicy";

const AIChatWidget = lazyWithRetry(() => import("@/components/AIChatWidget").then((m) => ({ default: m.AIChatWidget })));
const FeedbackWidget = lazyWithRetry(() =>
  import("@/components/FeedbackWidget").then((m) => ({ default: m.FeedbackWidget }))
);

// Lazy load heavy page chunks
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const DealerDashboard = lazyWithRetry(() => import("./pages/DealerDashboard"));
const ListingDetail = lazyWithRetry(() => import("./pages/ListingDetail"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Trends = lazyWithRetry(() => import("./pages/Trends"));
const Estimate = lazyWithRetry(() => import("./pages/Estimate"));
const Calculator = lazyWithRetry(() => import("./pages/Calculator"));
const EVHub = lazyWithRetry(() => import("./pages/EVHub"));
const EVChargers = lazyWithRetry(() => import("./pages/EVChargers"));
const BestPicks = lazyWithRetry(() => import("./pages/BestPicks"));
const SignIn = lazyWithRetry(() => import("./pages/SignIn"));
const SignUp = lazyWithRetry(() => import("./pages/SignUp"));
const ProDashboard = lazyWithRetry(() => import("./pages/ProDashboard"));
const ProPreview = lazyWithRetry(() => import("./pages/ProPreview"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const MakeModelHub = lazyWithRetry(() => import("./pages/MakeModelHub"));
const MakeHub = lazyWithRetry(() => import("./pages/MakeHub"));
const DistrictHub = lazyWithRetry(() => import("./pages/DistrictHub"));
const Alerts = lazyWithRetry(() => import("./pages/Alerts"));
const PriceIndex = lazyWithRetry(() => import("./pages/PriceIndex"));
const Docs = lazyWithRetry(() => import("./pages/Docs"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const OfficialPulse = lazyWithRetry(() => import("./pages/OfficialPulse"));
const OfficialPulseDetail = lazyWithRetry(() => import("./pages/OfficialPulseDetail"));
const OfficialPulseGuide = lazyWithRetry(() => import("./pages/OfficialPulseGuide"));
const HeroLab = lazyWithRetry(() => import("./pages/HeroLab"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const Permits = lazyWithRetry(() => import("./pages/Permits"));
const Compare = lazyWithRetry(() => import("./pages/Compare"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default leans toward market-style freshness; live listing queries
      // override with QUERY_STALE.listings (10s) at the call site.
      staleTime: QUERY_STALE.stats,
      gcTime: QUERY_STALE.market,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MinimalLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center" aria-label="Loading" role="status">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
        <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
      </div>
      <p className="tech-label">Loading</p>
    </div>
  </div>
);

function MainLayout({ chatMounted }: { chatMounted: boolean }) {
  return (
    <RequireAuth>
      <div className="min-h-screen app-shell selection:bg-primary/20 bg-background">
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        <Navbar />
        <SettingsFloatingIcon />
        <Suspense fallback={null}>
          <FeedbackWidget />
        </Suspense>
        {chatMounted && (
          <Suspense fallback={null}>
            <AIChatWidget />
          </Suspense>
        )}
        <main id="main-content" className="relative z-[1] pt-[4rem] pb-16 md:pb-0">
          <RouteErrorBoundary>
            <Suspense fallback={<MinimalLoader />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
        <AppFooter />
        <MobileBottomNav />
      </div>
    </RequireAuth>
  );
}

const App = () => {
  // Chat mounts after a short idle delay so its chunk never competes with
  // first paint; nothing else is gated behind an artificial loader.
  const [chatMounted, setChatMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setChatMounted(true), 2000);
    // Do not clear chunk/css reload guards on mount — that re-arms infinite
    // reload loops when a stale asset is still being served. Guards expire
    // via TTL in lazyWithRetry / index.html instead.
    return () => window.clearTimeout(id);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <MotionConfig reducedMotion="user">
            <ScrollProgressBar />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollRestoration />
              <RouteMeta />
              <Routes>
                <Route element={<MainLayout chatMounted={chatMounted} />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dealer" element={<DealerDashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/trends" element={<Trends />} />
                  <Route path="/estimate" element={<Estimate />} />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route path="/ev-hub" element={<EVHub />} />
                  <Route path="/ev-chargers" element={<EVChargers />} />
                  <Route path="/best-picks" element={<BestPicks />} />
                  <Route path="/listing/:id" element={<ListingDetail />} />
                  <Route path="/cars/:make/:model" element={<MakeModelHub />} />
                  <Route path="/cars/:make" element={<MakeHub />} />
                  <Route path="/locations/:district" element={<DistrictHub />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/price-index" element={<PriceIndex />} />
                  <Route path="/official-pulse" element={<OfficialPulse />} />
                  <Route path="/official-pulse/guide/:key" element={<OfficialPulseGuide />} />
                  <Route path="/official-pulse/:id" element={<OfficialPulseDetail />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route
                    path="/admin"
                    element={(
                      <RequireAdmin>
                        <AdminDashboard />
                      </RequireAdmin>
                    )}
                  />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/permits" element={<Permits />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/sign-in" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <SignIn />
                  </Suspense>
                } />
                <Route path="/sign-up" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <SignUp />
                  </Suspense>
                } />
                <Route path="/hero-lab" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <HeroLab />
                  </Suspense>
                } />
                <Route path="/pro-preview" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ProPreview />
                  </Suspense>
                } />
                <Route path="/pro" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ProtectedRoute><ProDashboard /></ProtectedRoute>
                  </Suspense>
                } />
              </Routes>
            </BrowserRouter>
          </MotionConfig>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
