import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 15, // 15 seconds (keeps rapid clicks instant while keeping data fresh)
        gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
        refetchOnWindowFocus: false, // Prevents annoying browser refetch freezes
        refetchOnMount: true, // Always fetch fresh data on navigation/mounting
        retry: 1, // Fast failure fallback without blocking retry delays
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
