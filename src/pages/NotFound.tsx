import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, MapPin, TrendingUp } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

const links = [
  { to: "/", label: "Inventory", icon: TrendingUp },
  { to: "/trends", label: "Price trends", icon: BarChart3 },
  { to: "/map", label: "District map", icon: MapPin },
];

const NotFound = () => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-bright">404</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Page not found.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground font-medium">This route doesn't exist. Try one of the links below.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] font-bold text-white no-underline transition-all hover:bg-white/[0.04]">
            <ArrowLeft className="h-3 w-3 text-primary" /> Back to dashboard
          </Link>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 relative z-10">
        <div className="grid gap-2 sm:grid-cols-3">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4 no-underline hover:border-primary/20 transition-all hover:bg-white/[0.02] backdrop-blur-md">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[13px] font-bold text-white">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default NotFound;
