import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  getNotifications,
  getOrCreateAlertToken,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/services/api";
import { formatRelativeTime } from "@/lib/formatting";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NOTIFICATIONS_QUERY_KEY = "notifications";

function notificationHref(notification: UserNotification): string {
  const href = String(notification.href || "").trim();
  return href.startsWith("/") ? href : "/alerts";
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const token = useMemo(() => getOrCreateAlertToken(), []);

  const notificationsQuery = useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, token],
    queryFn: () => getNotifications(token, 20),
    enabled: Boolean(token),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(token, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, token] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY, token] });
    },
  });

  const markRead = (id: number) => {
    if (!markReadMutation.isPending) {
      markReadMutation.mutate(id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(360px,calc(100vw-24px))] rounded-3xl border-border bg-popover/95 p-0 text-foreground shadow-soft-lg backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread alert update${unreadCount === 1 ? "" : "s"}` : "No unread updates"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>

        <DropdownMenuSeparator className="m-0 bg-border" />

        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {notificationsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading notifications
            </div>
          ) : notificationsQuery.isError ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground">
              Couldn't load notifications.
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" aria-hidden />
              <p className="text-[12px] font-medium text-muted-foreground">No notifications yet.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">New alert matches will appear here.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const unread = !notification.read_at;
              return (
                <div
                  key={notification.id}
                  className={`group rounded-2xl border p-3 transition-colors ${
                    unread
                      ? "border-primary/20 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-foreground/[0.03]"
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        unread ? "bg-primary" : "bg-muted-foreground/25"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={notificationHref(notification)}
                        onClick={() => {
                          if (unread) markRead(notification.id);
                        }}
                        className="block no-underline outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {notification.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                          {notification.body}
                        </p>
                      </Link>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground/80">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                        {unread ? (
                          <button
                            type="button"
                            onClick={() => markRead(notification.id)}
                            disabled={markReadMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-primary-bright transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" aria-hidden />
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
