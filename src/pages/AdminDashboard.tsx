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

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
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
      className="mx-auto max-w-[1200px] space-y-8 px-5 py-8 sm:px-6"
    >
      <motion.header variants={revealItem} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Admin console</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
            Motormila control
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Signed in as {user?.email}. Invite users, set free/pro plans, and watch platform health.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            void overviewQuery.refetch();
            void usersQuery.refetch();
            void invitesQuery.refetch();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </Button>
      </motion.header>

      <motion.section variants={revealItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overviewQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[104px] rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Live listings"
              value={overview?.listings.live ?? 0}
              hint={`${overview?.listings.total ?? 0} total scraped`}
              icon={Car}
            />
            <StatCard
              label="Users"
              value={overview?.users.total ?? 0}
              hint={`${overview?.users.free ?? 0} free · ${overview?.users.pro ?? 0} pro`}
              icon={Users}
            />
            <StatCard
              label="Pending invites"
              value={overview?.invites.pending ?? 0}
              hint={`${overview?.users.admins ?? 0} admins`}
              icon={MailPlus}
            />
            <StatCard
              label="Open feedback"
              value={overview?.feedback.open ?? 0}
              hint={`${overview?.dealers.verified ?? 0} verified dealers`}
              icon={Activity}
            />
          </>
        )}
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section variants={revealItem} className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <MailPlus className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-lg font-semibold text-foreground">Invite by email</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Only invited emails can create an account. Choose free (limited / blurred Pro) or pro (full access).
          </p>
          <form onSubmit={onInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="dealer@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={invitePlan} onValueChange={(value) => setInvitePlan(value as typeof invitePlan)}>
                  <SelectTrigger>
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
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as typeof inviteRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={inviteMutation.isPending} className="w-full gap-2">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              {inviteMutation.isPending ? "Creating…" : "Create invite"}
            </Button>
          </form>
          {lastInviteLink ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Share this link</p>
              <p className="mt-1 break-all text-[12px] font-medium text-foreground">{lastInviteLink}</p>
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => void copyLink(lastInviteLink)}>
                <Copy className="h-3 w-3" aria-hidden />
                Copy link
              </Button>
            </div>
          ) : null}

          <div className="mt-6 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Pending invites</h3>
            {invitesQuery.isLoading ? (
              <Skeleton className="h-16 rounded-lg" />
            ) : pendingInvites.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending invites.</p>
            ) : (
              pendingInvites.map((invite: AdminInvite) => {
                const link = `${window.location.origin}${invite.signupPath}`;
                return (
                  <div key={invite.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{invite.email}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {invite.plan} · {invite.role}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(link)}>
                          <Copy className="h-3 w-3" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
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

        <motion.section variants={revealItem} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-lg font-semibold">Top makes (live)</h2>
            </div>
            <div className="space-y-2">
              {(overview?.topMakes || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No live listing mix yet.</p>
              ) : (
                overview?.topMakes.map((row) => (
                  <div key={row.make} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="text-sm font-semibold text-foreground">{row.make}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-lg font-semibold">Recent scrapes</h2>
            </div>
            <div className="space-y-2">
              {(overview?.recentScrapes || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No scrape runs recorded.</p>
              ) : (
                overview?.recentScrapes.map((run) => (
                  <div key={run.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{run.source}</p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        {run.status || "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      found {run.listingsFound} · new {run.listingsNew}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.section>
      </div>

      <motion.section variants={revealItem} className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="font-display text-lg font-semibold">Users & plans</h2>
        </div>
        {usersQuery.isLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : (usersQuery.data?.users || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No database users yet. Sign in with an AUTH_USERS bootstrap admin once to sync, or invite someone.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-bold">User</th>
                  <th className="pb-2 pr-3 font-bold">Plan</th>
                  <th className="pb-2 pr-3 font-bold">Role</th>
                  <th className="pb-2 pr-3 font-bold">Status</th>
                  <th className="pb-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data?.users || []).map((row: AdminUser) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-foreground">{row.name}</p>
                      <p className="text-[11px] text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <Select
                        value={row.plan}
                        onValueChange={(plan) =>
                          updateUserMutation.mutate({ id: row.id, patch: { plan: plan as AdminUser["plan"] } })
                        }
                      >
                        <SelectTrigger className="h-8 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pr-3">
                      <Select
                        value={row.role}
                        onValueChange={(role) =>
                          updateUserMutation.mutate({ id: row.id, patch: { role: role as AdminUser["role"] } })
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        {row.isActive ? <Check className="h-3 w-3 text-primary" /> : null}
                        {row.isActive ? "Active" : "Disabled"} · {row.subscriptionStatus}
                      </span>
                    </td>
                    <td className="py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={row.email === user?.email}
                        onClick={() =>
                          updateUserMutation.mutate({
                            id: row.id,
                            patch: { is_active: !row.isActive },
                          })
                        }
                      >
                        {row.isActive ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
