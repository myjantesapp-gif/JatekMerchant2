import {
  useListAds,
  useListShorts,
} from "@workspace/api-client-react";

/** All active ads, sorted by sortOrder (server-side). Filter client-side by type. */
export function useAds() {
  return useListAds();
}

/** Active shorts managed from the admin dashboard. */
export function useShorts() {
  return useListShorts();
}
