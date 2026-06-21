import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, Lightbulb, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { sendFeedback, type FeedbackInput } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LOCAL_FEEDBACK_KEY = "autolens.feedback.offline.v1";
const CATEGORY_OPTIONS: Array<{ value: FeedbackInput["category"]; label: string; icon: typeof MessageSquare }> = [
  { value: "bug", label: "Bug", icon: Bug },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "data", label: "Data issue", icon: MessageSquare },
  { value: "ux", label: "UX", icon: MessageSquare },
  { value: "general", label: "General", icon: MessageSquare },
];

function storeOfflineFeedback(payload: FeedbackInput) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(window.localStorage.getItem(LOCAL_FEEDBACK_KEY) || "[]");
    const rows = Array.isArray(existing) ? existing : [];
    window.localStorage.setItem(
      LOCAL_FEEDBACK_KEY,
      JSON.stringify([{ ...payload, saved_at: new Date().toISOString() }, ...rows].slice(0, 20)),
    );
  } catch {
    window.localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify([{ ...payload, saved_at: new Date().toISOString() }]));
  }
}

export function FeedbackWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackInput["category"]>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = message.trim().length >= 8 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const payload: FeedbackInput = {
      category,
      message: message.trim(),
      email: email.trim() || undefined,
      route: `${location.pathname}${location.search}`,
    };

    setSubmitting(true);
    try {
      await sendFeedback(payload);
      toast.success("Feedback sent");
    } catch {
      storeOfflineFeedback(payload);
      toast.info("Feedback saved locally and can be resent later");
    } finally {
      setSubmitting(false);
      setMessage("");
      setEmail("");
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="floating-action-menu-item floating-control fixed bottom-20 left-5 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#080a09]/92 text-zinc-300 backdrop-blur-xl transition-colors hover:border-amber-300/30 hover:text-amber-100 max-sm:hidden"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-white/10 bg-[#0a0a0a] text-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">Send Feedback</DialogTitle>
            <DialogDescription className="sr-only">
              Send a bug, idea, data, user experience, or general note to the AutoLens team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategory(option.value)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      category === option.value
                        ? "border-amber-300/35 bg-amber-500/12 text-amber-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should AutoLens fix or improve?"
              className="min-h-[130px] rounded-xl border-white/10 bg-black/25 text-sm text-zinc-100 placeholder:text-zinc-600"
            />

            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="Email optional"
              className="h-10 rounded-xl border-white/10 bg-black/25 text-sm text-zinc-100"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="ui-caption font-semibold text-zinc-500">
                Route: {location.pathname || "/"}
              </p>
              <Button
                disabled={!canSubmit}
                onClick={submit}
                className="h-10 rounded-xl bg-amber-500 px-4 text-xs font-bold uppercase tracking-[0.12em] text-black hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="mr-2 h-3.5 w-3.5" />
                {submitting ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
