import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/collection")({
  component: CollectionPage,
});

function CollectionPage() {
  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-4xl font-bold mb-4">Collections</h1>
      <p className="text-gray-500">Browse products by category.</p>
    </div>
  );
}
