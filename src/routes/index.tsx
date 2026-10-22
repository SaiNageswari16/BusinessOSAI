import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

export const Route = createFileRoute("/")({
  component: DashboardScreen,
});
