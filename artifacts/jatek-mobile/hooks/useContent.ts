import { useQuery } from "@tanstack/react-query";
import { useListAds } from "@workspace/api-client-react";

import { listShorts } from "@/lib/api";

/** All active ads, sorted by sortOrder (server-side). Filter client-side by type. */
export function useAds() {
  return useListAds();
}

/** Active shorts managed from the admin dashboard. */
export function useShorts() {
  return useQuery({
    queryKey: ["shorts"],
    queryFn: listShorts,
    staleTime: 60_000,
  });
}
