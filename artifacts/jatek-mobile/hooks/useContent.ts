import { useQuery } from "@tanstack/react-query";
import { listAds, listShorts, type Ad, type Short } from "@/lib/api";

/** All active ads, sorted by sortOrder (server-side). Filter client-side by type. */
export function useAds() {
  return useQuery<Ad[]>({
    queryKey: ["ads"],
    queryFn: () => listAds(),
    staleTime: 60_000,
  });
}

/** Active shorts managed from the admin dashboard. */
export function useShorts() {
  return useQuery<Short[]>({
    queryKey: ["shorts"],
    queryFn: () => listShorts(),
    staleTime: 60_000,
  });
}
