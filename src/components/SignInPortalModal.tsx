import { ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SignInPortalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SignInPortalModal({ open, onOpenChange }: SignInPortalModalProps) {
  const navigate = useNavigate();

  const handleProAccess = () => {
    onOpenChange(false);
    navigate("/sign-in");
  };

  const handlePreviewAccess = () => {
    onOpenChange(false);
    navigate("/pro-preview");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/10 bg-[#0b0d0f] text-white rounded-xl p-8">
        <DialogHeader className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/14 text-amber-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-2xl tracking-tight">Sign In Portal</DialogTitle>
          <DialogDescription className="text-zinc-400 leading-relaxed">
            Sign in to your Pro Intelligence account for full market analytics, or continue as a guest to browse public listings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleProAccess}
            className="h-12 rounded-xl border-amber-500/35 bg-amber-500/12 text-amber-100 hover:bg-amber-500/20"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Sign In to Pro Dashboard
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewAccess}
            className="h-12 rounded-xl border-white/12 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Preview Pro Features
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-xl bg-white/5 border border-white/12 text-white hover:bg-white/10"
          >
            <UserRound className="h-4 w-4 mr-2" />
            Guest Access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
