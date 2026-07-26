import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/blog")({
  component: BlogPage,
});

function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-4xl font-bold mb-4">Blog</h1>
      <p className="text-gray-500">Read our latest articles on organic living.</p>
    </div>
  );
}
