import { createFileRoute } from "@tanstack/react-router";
import { UnifiedGatewayPage } from "./index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — BusinessOS Unified Portal Gateway" },
      {
        name: "description",
        content:
          "Single unified login gateway for all integrated business verticals: RestaurantOS, Salon & Spa, Gym & Fitness, Retail, Hotel, and Platform Super Admin.",
      },
    ],
  }),
  component: UnifiedGatewayPage,
});
