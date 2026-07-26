import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/pages")({
  component: PagesPage,
});

function PagesPage() {
  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-4xl font-bold mb-4">Pages</h1>
      <p className="text-gray-500">About us, Contact, and Policies.</p>
    </div>
  );
}
