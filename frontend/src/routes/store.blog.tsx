import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, ArrowRight, Calendar, User, Tag, Clock, Share2 } from "lucide-react";
import { organicBlogPosts, OrganicBlogPost } from "@/data/mockOrganicData";
import { toast } from "sonner";

export const Route = createFileRoute("/store/blog")({
  component: BlogPage,
});

function BlogPage() {
  const [selectedPost, setSelectedPost] = useState<OrganicBlogPost | null>(null);

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Our Journals & Organic Living
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Blog</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {organicBlogPosts.map((post) => (
            <article
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col"
            >
              <div className="aspect-[16/10] overflow-hidden bg-gray-100 relative">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs text-gray-800 text-[10px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                  {post.date}
                </span>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                    <span className="text-[#6BB252] font-extrabold uppercase">{post.category}</span>
                    <span>•</span>
                    <span>By {post.author}</span>
                  </div>

                  <h2 className="font-bold text-base text-gray-900 group-hover:text-[#6BB252] transition-colors leading-snug">
                    {post.title}
                  </h2>

                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-[#6BB252]">
                  <span>Read Full Article</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Selected Post Modal */}
        {selectedPost && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 animate-in fade-in zoom-in duration-150">
              <div className="aspect-[16/9] rounded-2xl overflow-hidden">
                <img
                  src={selectedPost.image}
                  alt={selectedPost.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="bg-[#f0f7ed] text-[#6BB252] font-bold px-2.5 py-0.5 rounded-full">
                    {selectedPost.category}
                  </span>
                  <span>•</span>
                  <span>{selectedPost.date}</span>
                  <span>•</span>
                  <span>By {selectedPost.author}</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-gray-900 font-organic-heading leading-tight">
                  {selectedPost.title}
                </h2>

                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {selectedPost.excerpt}
                </p>

                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  Choosing organic produce means prioritizing nutrient density, clean soil ecosystems,
                  and avoiding toxic chemical pesticides. Studies demonstrate that organic cultivation preserves
                  up to 40% higher antioxidant concentrations and essential trace minerals.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast.success("Article link copied to clipboard!");
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="px-6 py-2 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
