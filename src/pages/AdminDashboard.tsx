import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  Car,
  Check,
  Copy,
  Crown,
  MailPlus,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAdminInvite,
  getAdminInvites,
  getAdminOverview,
  getAdminUsers,
  revokeAdminInvite,
  updateAdminUser,
  type AdminInvite,
  type AdminUser,
} from "@/services/api";
import { useAuth } from "@/lib/authContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { revealContainer, revealItem } from "@/lib/motion";
import { BRAND } from "@/lib/brand";
import { useAppPreferences } from "@/lib/appPreferences";

function formatCount(value: number | undefined) {
  return Number(value || 0).toLocaleString();
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="metric-tile group p-5 transition-all hover:-translate-y-0.5 hover:border-primary/25">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tech-label text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-[1.85rem] font-semibold tracking-tight text-foreground num">{value}</p>
          {hint ? <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 transition-colors group-hover:border-primary/30">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useAppPreferences();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePlan, setInvitePlan] = useState<"free" | "pro" | "enterprise">("free");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [lastInviteLink, setLastInviteLink] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
    refetchInterval: 60_000,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getAdminUsers({ limit: 200 }),
  });
  const invitesQuery = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => getAdminInvites(),
  });

  const inviteMutation = useMutation({
    mutationFn: createAdminInvite,
    onSuccess: (invite) => {
      const absolute = `${window.location.origin}${invite.signupPath}`;
      setLastInviteLink(absolute);
      setInviteEmail("");
      toast.success(`Invite created for ${invite.email}`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message || "Invite failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAdminInvite,
    onSuccess: () => {
      toast.success("Invite revoked");
      void queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
    onError: (error: Error) => toast.error(error.message || "Revoke failed"),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof updateAdminUser>[1] }) =>
      updateAdminUser(id, patch),
    onSuccess: () => {
      toast.success("User updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error: Error) => toast.error(error.message || "Update failed"),
  });

  const overview = overviewQuery.data;
  const pendingInvites = useMemo(
    () => (invitesQuery.data?.invites || []).filter((invite) => invite.status === "pending"),
    [invitesQuery.data],
  );

  const onInvite = (event: FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Enter an email");
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      plan: invitePlan,
      role: inviteRole,
    });
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy — select the link manually");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)]" />

      <div className="relative mx-auto max-w-[1240px] space-y-10 px-5 py-10 sm:px-6 lg:py-12">
        <motion.header variants={revealItem} className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              {t("admin.eyebrow", "Admin console")}
            </p>
            <h1 className="display-1 text-foreground">
              {t("admin.title", "{brand} control.", { brand: BRAND.name })}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              {t("admin.subtitle", "Signed in as {email}. Provision seats, set free or Pro access, and monitor the live market pipeline.", { email: user?.email || "" })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-full border-border bg-card px-5 shadow-soft"
            onClick={() => {
              void overviewQuery.refetch();
              void usersQuery.refetch();
              void invitesQuery.refetch();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t("common.refresh", "Refresh")}
          </Button>
        </motion.header>

        <motion.section variants={revealItem} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overviewQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[124px] rounded-[20px]" />)
          ) : (
            <>
              <MetricTile
                label={t("admin.liveListings", "Live listings")}
                value={formatCount(overview?.listings.live)}
                hint={`${formatCount(overview?.listings.total)} total scraped`}
                icon={Car}
              />
              <MetricTile
                label={t("admin.seatedUsers", "Seated users")}
                value={formatCount(overview?.users.total)}
                hint={`${formatCount(overview?.users.free)} free · ${formatCount(overview?.users.pro)} pro`}
                icon={Users}
              />
              <MetricTile
                label={t("admin.pendingInvites", "Pending invites")}
                value={formatCount(overview?.invites.pending)}
                hint={`${formatCount(overview?.users.admins)} admins`}
                icon={MailPlus}
              />
              <MetricTile
                label={t("admin.openFeedback", "Open feedback")}
                value={formatCount(overview?.feedback.open)}
                hint={`${formatCount(overview?.dealers.verified)} verified dealers`}
                icon={Activity}
              />
            </>
          )}
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <motion.section variants={revealItem} className="premium-surface p-6 sm:p-7 shadow-soft-lg">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                <MailPlus className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{t("admin.inviteByEmail", "Invite by email")}</h2>
                <p className="text-[12px] text-muted-foreground">{t("admin.inviteHint", "Only invited addresses can create an account.")}</p>
              </div>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              Choose <span className="font-semibold text-foreground">Free</span> for a guided teaser with locked Pro depth,
              or <span className="font-semibold text-foreground">Pro</span> for the full terminal.
            </p>

            <form onSubmit={onInvite} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="field-label">{t("admin.email", "Email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="dealer@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="h-11 rounded-xl bg-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="field-label">{t("admin.plan", "Plan")}</Label>
                  <Select value={invitePlan} onValueChange={(value) => setInvitePlan(value as typeof invitePlan)}>
                    <SelectTrigger className="h-11 rounded-xl bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">{t("admin.role", "Role")}</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as typeof inviteRole)}>
                    <SelectTrigger className="h-11 rounded-xl bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={inviteMutation.isPending} className="h-11 w-full gap-2 rounded-full text-[12px] font-bold uppercase tracking-[0.1em]">
                <Crown className="h-3.5 w-3.5" aria-hidden />
                {inviteMutation.isPending ? t("admin.creating", "Creating…") : t("admin.createInvite", "Create invite")}
              </Button>
            </form>

            {lastInviteLink ? (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                <p className="tech-label text-primary-bright">{t("admin.shareLink", "Share this link")}</p>
                <p className="mt-2 break-all text-[12px] font-medium leading-relaxed text-foreground">{lastInviteLink}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3 h-9 gap-1.5 rounded-full" onClick={() => void copyLink(lastInviteLink)}>
                  <Copy className="h-3 w-3" aria-hidden />
                  Copy link
                </Button>
              </div>
            ) : null}

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="tech-label text-muted-foreground">{t("admin.pendingInvites", "Pending invites")}</h3>
                <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {pendingInvites.length}
                </span>
              </div>
              {invitesQuery.isLoading ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : pendingInvites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-center">
                  <Sparkles className="mx-auto h-4 w-4 text-primary/60" aria-hidden />
                  <p className="mt-2 text-[13px] text-muted-foreground">{t("admin.noPendingInvites", "No pending invites.")}</p>
                </div>
              ) : (
                pendingInvites.map((invite: AdminInvite) => {
                  const link = `${window.location.origin}${invite.signupPath}`;
                  return (
                    <div key={invite.id} className="rounded-2xl border border-border bg-surface/80 p-4 transition-colors hover:border-primary/25">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-foreground">{invite.email}</p>
                          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            {invite.plan} · {invite.role}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button type="button" size="sm" variant="outline" className="h-9 rounded-full" onClick={() => void copyLink(link)}>
                            <Copy className="h-3 w-3" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 rounded-full text-muted-foreground"
                            onClick={() => revokeMutation.mutate(invite.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.section>

          <motion.section variants={revealItem} className="space-y-5">
            <div className="data-card p-6">
              <div className="mb-5 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="font-display text-lg font-semibold tracking-tight">{t("admin.topMakes", "Top makes · live")}</h2>
              </div>
              <div className="space-y-2">
                {(overview?.topMakes || []).length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No live listing mix yet.</p>
                ) : (
                  overview?.topMakes.map((row, index) => (
                    <div
                      key={row.make}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface/70 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-[13px] font-semibold text-foreground">{row.make}</span>
                      </div>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{row.count.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="data-card p-6">
              <div className="mb-5 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="font-display text-lg font-semibold tracking-tight">{t("admin.recentScrapes", "Recent scrapes")}</h2>
              </div>
              <div className="space-y-2">
                {(overview?.recentScrapes || []).length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No scrape runs recorded.</p>
                ) : (
                  overview?.recentScrapes.map((run) => (
                    <div key={run.id} className="rounded-xl border border-border bg-surface/70 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-foreground">{run.source}</p>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          {run.status || "—"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        found {run.listingsFound.toLocaleString()} · new {run.listingsNew.toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section variants={revealItem} className="premium-surface overflow-hidden p-0 shadow-soft-lg">
          <div className="border-b border-border px-6 py-5 sm:px-7">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-lg font-semibold tracking-tight">{t("admin.usersPlans", "Users & plans")}</h2>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Upgrade free seats to Pro instantly — changes apply on their next session refresh.
            </p>
          </div>
          <div className="p-6 sm:p-7">
            {usersQuery.isLoading ? (
              <Skeleton className="h-44 rounded-2xl" />
            ) : (usersQuery.data?.users || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-5 py-10 text-center">
                <p className="text-[14px] font-medium text-foreground">{t("admin.noUsers", "No database users yet")}</p>
                <p className="mx-auto mt-2 max-w-md text-[13px] text-muted-foreground">
                  Sign in once with an AUTH_USERS bootstrap admin to sync, or create your first invite above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="pb-3 pr-3 font-bold">User</th>
                      <th className="pb-3 pr-3 font-bold">Plan</th>
                      <th className="pb-3 pr-3 font-bold">Role</th>
                      <th className="pb-3 pr-3 font-bold">Status</th>
                      <th className="pb-3 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersQuery.data?.users || []).map((row: AdminUser) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-4 pr-3">
                          <p className="font-semibold text-foreground">{row.name}</p>
                          <p className="text-[11px] text-muted-foreground">{row.email}</p>
                        </td>
                        <td className="py-4 pr-3">
                          <Select
                            value={row.plan}
                            onValueChange={(plan) =>
                              updateUserMutation.mutate({ id: row.id, patch: { plan: plan as AdminUser["plan"] } })
                            }
                          >
                            <SelectTrigger className="h-9 w-[128px] rounded-full bg-surface">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-4 pr-3">
                          <Select
                            value={row.role}
                            onValueChange={(role) =>
                              updateUserMutation.mutate({ id: row.id, patch: { role: role as AdminUser["role"] } })
                            }
                          >
                            <SelectTrigger className="h-9 w-[118px] rounded-full bg-surface">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-4 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            {row.isActive ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                            {row.isActive ? t("admin.active", "Active") : t("admin.disabled", "Disabled")} · {row.subscriptionStatus}
                          </span>
                        </td>
                        <td className="py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-full"
                            disabled={row.email === user?.email}
                            onClick={() =>
                              updateUserMutation.mutate({
                                id: row.id,
                                patch: { is_active: !row.isActive },
                              })
                            }
                          >
                            {row.isActive ? t("admin.disable", "Disable") : t("admin.enable", "Enable")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
