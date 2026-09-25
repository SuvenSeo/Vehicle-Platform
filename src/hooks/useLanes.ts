import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { FREE_GAP_LIMIT, FREE_LANE_LIMIT, gateGaps, gateLanes } from "@/lib/laneGating";
import { getProArbitrageGaps, getProVehicleLanes } from "@/services/api";
import type { ProArbitrageGap, ProVehicleLane } from "@/types/pro";

export { FREE_GAP_LIMIT, FREE_LANE_LIMIT };

export interface UseLanesOptions {
  /** Max lanes to request from the API. */
  laneLimit?: number;
  /** When both are set, arbitrage gaps load for this lane. */
  gapMake?: string;
  gapModel?: string;
  /** Max gaps to request from the API. */
  gapLimit?: number;
  /** Set false to fetch manually via reloadLanes/reloadGaps. */
  autoLoad?: boolean;
}

/**
 * Real Pro lane data with trial gating.
 * Free visitors get 1 lane / 3 gaps visible (rest blurred by the UI) and
 * watermarked exports; Pro + trialing plans get everything unwatermarked.
 */
export function useLanes(options: UseLanesOptions = {}) {
  const { hasProAccess } = useAuth();
  const { laneLimit = 80, gapMake, gapModel, gapLimit = 10, autoLoad = true } = options;

  const [lanes, setLanes] = useState<ProVehicleLane[]>([]);
  const [gaps, setGaps] = useState<ProArbitrageGap[]>([]);
  const [loadingLanes, setLoadingLanes] = useState(autoLoad);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadLanes = useCallback(async () => {
    setError(null);
    setLoadingLanes(true);
    try {
      setLanes(await getProVehicleLanes({ limit: laneLimit }));
    } catch {
      setError("Unable to load vehicle lanes.");
    } finally {
      setLoadingLanes(false);
    }
  }, [laneLimit]);

  const reloadGaps = useCallback(
    async (make: string, model: string) => {
      if (!make || !model) {
        setGaps([]);
        return;
      }
      setLoadingGaps(true);
      try {
        setGaps(await getProArbitrageGaps(make, model, gapLimit));
      } catch {
        setGaps([]);
      } finally {
        setLoadingGaps(false);
      }
    },
    [gapLimit],
  );

  useEffect(() => {
    if (autoLoad) void reloadLanes();
  }, [autoLoad, reloadLanes]);

  useEffect(() => {
    if (gapMake && gapModel) void reloadGaps(gapMake, gapModel);
    else setGaps([]);
  }, [gapMake, gapModel, reloadGaps]);

  const gatedLanes = gateLanes(lanes, hasProAccess);
  const gatedGaps = gateGaps(gaps, hasProAccess);

  return {
    lanes,
    gaps,
    visibleLanes: gatedLanes.visible,
    lockedLaneCount: gatedLanes.lockedCount,
    visibleGaps: gatedGaps.visible,
    lockedGapCount: gatedGaps.lockedCount,
    /** True when the trial gate is active (blur + watermark apply). */
    isGated: !hasProAccess,
    /** Pass straight into lane-pack exports. */
    watermark: !hasProAccess,
    hasProAccess,
    loadingLanes,
    loadingGaps,
    loading: loadingLanes || loadingGaps,
    error,
    reloadLanes,
    reloadGaps,
  };
}
