import { createFileRoute } from "@tanstack/react-router";
import { Route as PortfolioRoute } from "./_app.portfolio";

export const Route = createFileRoute("/_app/owner-portfolio")({
  component: PortfolioRoute.options.component,
});
