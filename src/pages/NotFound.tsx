import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, BarChart3, MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/SectionHeader";
import { revealContainer, revealItem, springSnappy } from "@/lib/motion";

const links = [
  {
    to: "/",
    label: "Inventory",
    description: "Browse every live listing, ranked against the market.",
    icon: TrendingUp,
    featured: true,
  },
  {
    to: "/trends",
    label: "Price trends",
    description: "Track how values move, week over week.",
    icon: BarChart3,
    featured: false,
  },
  {
    to: "/calculator",
    label: "Import calculator",
    description: "Break down duty, tax, and landed cost.",
    icon: MapPin,
    featured: false,
  },
] as const;

const NotFound = () => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen overflow-hidden bg-background"
    >
      {/* Decorative accent glow — token-tinted, correct in both themes */}
      <div className="pointer-events-none absolute right-[-10%] top-[8%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[16%] left-[-15%] h-[400px] w-[400px] rounded-full bg-primary/5 blur-[90px]" />

      {/* Hero — one confident, towering headline */}
      <section className="relative z-10">
        <div className="layout-shell py-16 sm:py-24 lg:py-32">
          <motion.p
            variants={revealItem}
            className="num section-eyebrow text-primary-bright"
          >
            404
          </motion.p>
          <motion.h1
            variants={revealItem}
            className="display-hero mt-4 max-w-4xl text-foreground"
          >
            Page not found.
          </motion.h1>
          <motion.p
            variants={revealItem}
            className="text-body-lg mt-5 max-w-xl"
          >
            This route doesn't exist. Try one of the links below.
          </motion.p>
          <motion.div variants={revealItem} className="mt-9">
            <Button asChild size="lg" variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to dashboard
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Quick links — one featured card, then a calm secondary row */}
      <section className="relative z-10">
        <div className="layout-shell pb-20 lg:pb-28">
          <motion.div variants={revealItem}>
            <SectionHeader
              eyebrow="Popular destinations"
              title="Pick up where you left off"
            />
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-3">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <motion.div
                  key={l.to}
                  variants={revealItem}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  transition={springSnappy}
                  className={l.featured ? "lg:col-span-3" : ""}
                >
                  <Link
                    to={l.to}
                    className={
                      l.featured
                        ? "group flex items-center gap-5 rounded-2xl border border-border bg-card p-6 no-underline shadow-soft transition-colors hover:border-primary/40 sm:p-8"
                        : "group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 no-underline shadow-soft transition-colors hover:border-primary/40"
                    }
                  >
                    <div
                      className={
                        l.featured
                          ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface"
                          : "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
                      }
                    >
                      <Icon
                        className={l.featured ? "h-6 w-6 text-primary" : "h-5 w-5 text-primary"}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            l.featured
                              ? "text-lg font-semibold text-foreground"
                              : "text-base font-semibold text-foreground"
                          }
                        >
                          {l.label}
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                          aria-hidden
                        />
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {l.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default NotFound;
