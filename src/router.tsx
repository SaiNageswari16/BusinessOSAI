import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 15, // 15 mins cache
        gcTime: 1000 * 60 * 60, // 1 hour memory cache
        refetchOnWindowFocus: false, // CRITICAL: Never reload or refetch when switching browser tabs
        refetchOnMount: false, // Instant cache on remount
        refetchOnReconnect: false,
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent", // Preloads routes on hover for instant 0ms switching
    defaultPreloadDelay: 20,
    defaultPreloadStaleTime: 1000 * 60 * 10,
  });

  return router;
};
