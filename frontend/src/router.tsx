import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes cache (instant page switches without refetching)
        gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
        refetchOnWindowFocus: false, // Prevents 1-minute browser freeze when switching tabs
        refetchOnMount: false, // Uses cached data instantly on component re-mount
        retry: 1, // Fast failure fallback without 3x blocking retry delays
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent", // Preloads routes on hover for instant clicks
    defaultPreloadStaleTime: 1000 * 60 * 5,
  });

  return router;
};
