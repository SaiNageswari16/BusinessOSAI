import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StorefrontHomeContent, StoreNotFound } from "./store.index";
import { useStoreTheme } from "@/contexts/StoreThemeContext";

export const Route = createFileRoute("/store/$storeSlug")({
  component: DedicatedStorePage,
});

function DedicatedStorePage() {
  const { storeSlug } = Route.useParams();
  const { isStoreNotFound, isLoading } = useStoreTheme();

  if (isStoreNotFound) {
    return <StoreNotFound slug={storeSlug} />;
  }

  return <StorefrontHomeContent dedicatedSlug={storeSlug} />;
}
