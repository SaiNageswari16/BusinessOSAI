import { createFileRoute } from "@tanstack/react-router";
import { KotScreen } from "./kot";

export const Route = createFileRoute("/kitchen")({
  component: KotScreen,
});
