import { useCallback, useEffect, useState } from "react";

import {
  createAlert,
  deleteAlert,
  getAlerts,
  getOrCreateAlertToken,
  type AlertCreateInput,
  type ServerMarketAlert,
} from "@/services/api";

export interface UseServerMarketAlertsResult {
  alerts: ServerMarketAlert[];
  loading: boolean;
  error: string | null;
  token: string;
  refresh: () => Promise<void>;
  create: (data: AlertCreateInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export function useServerMarketAlerts(): UseServerMarketAlertsResult {
  const [alerts, setAlerts] = useState<ServerMarketAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token] = useState<string>(() => getOrCreateAlertToken());

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAlerts(token);
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (data: AlertCreateInput) => {
      await createAlert(token, data);
      await refresh();
    },
    [token, refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteAlert(token, id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    },
    [token],
  );

  return { alerts, loading, error, token, refresh, create, remove };
}
