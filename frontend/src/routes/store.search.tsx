import { createFileRoute, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/store/search")({
  component: SearchPage,
});

function SearchPage() {
  const routerState = useRouterState();
  const searchParams = new URLSearchParams(routerState.location.searchStr);
  const query = searchParams.get('q') || '';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Search Results</h1>
      <p className="text-gray-600 mb-6">
        {query ? `Showing results for "${query}"` : "Please enter a search term."}
      </p>
      
      <div className="bg-white p-12 text-center text-gray-500 rounded-lg shadow-sm">
        <p>The search functionality is currently being built. Check back soon!</p>
      </div>
    </div>
  );
}
