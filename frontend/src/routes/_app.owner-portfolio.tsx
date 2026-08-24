import { createFileRoute } from "@tanstack/react-router";
import { BusinessOwnerPortfolioPage } from "./_app.portfolio";

export const Route = createFileRoute("/_app/owner-portfolio")({
  component: BusinessOwnerPortfolioPage,
});

