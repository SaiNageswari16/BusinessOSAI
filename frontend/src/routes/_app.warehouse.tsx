import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/warehouse")({
  component: () => <ComingSoon title="Warehouse" description="Bin-level WMS with pick/pack/ship, mobile scanning and automated putaway optimization." />,
});
