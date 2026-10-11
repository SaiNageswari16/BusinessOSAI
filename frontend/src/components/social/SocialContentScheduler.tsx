import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Video,
  Globe,
  Share2,
  Trash2,
  Edit3,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Tag,
  X,
  Play,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { socialMediaApi, type ScheduledSocialPostItem } from "@/lib/api-client";
import { useRbac } from "@/contexts/rbac-context";
import { BatchSeoPhotoSchedulerModal } from "./BatchSeoPhotoSchedulerModal";

export function SocialContentScheduler() {
  const { hasPermission } = useRbac();
  const canSchedule = hasPermission("schedule:social_media_posts") || hasPermission("create:social_media_posts");

  const [posts, setPosts] = useState<ScheduledSocialPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"google_seo" | "youtube" | "twitter" | "multi">("google_seo");

  // Form states
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["google_business"]);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceCadence, setRecurrenceCadence] = useState("daily");
  const [category, setCategory] = useState("seo_photo");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [channelsHealth, setChannelsHealth] = useState<Record<string, { status: string; page?: string; handle?: string; channel?: string; location?: string }> | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const [data, summary] = await Promise.all([
        socialMediaApi.getScheduledPosts(),
        socialMediaApi.getAnalyticsSummary().catch(() => null),
      ]);
      setPosts(data || []);
      if (summary?.channels_health) {
        setChannelsHealth(summary.channels_health);
      }
    } catch (err) {
      console.warn("Could not load scheduled posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const openSchedulerModal = (type: "google_seo" | "youtube" | "twitter" | "multi") => {
    setModalType(type);
    setIsModalOpen(true);
    if (type === "google_seo") {
      setSelectedPlatforms(["google_business"]);
      setCategory("seo_photo");
      setTitle("Fresh Storefront & In-Stock Showcase");
      setContentText("Discover our latest arrivals at IoTRONCS Kukatpally! Open today from 9:00 AM to 10:00 PM. #Hyderabad #Retail");
      setMediaUrl("https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&w=800&q=80");
      setIsRecurring(true);
      setRecurrenceCadence("daily");
    } else if (type === "youtube") {
      setSelectedPlatforms(["youtube"]);
      setCategory("video_drop");
      setTitle("IoTRONCS Cloud OS: Next-Gen Smart Retail POS Demo (Full Walkthrough)");
      setContentText("Watch the full demonstration of automated barcode billing, thermal printer sync, and real-time inventory tracking.");
      setMediaUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
      setThumbnailUrl("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80");
      setTagsInput("CloudOS, RetailPOS, BusinessAutomation, IoTRONCS");
      setIsRecurring(false);
    } else if (type === "twitter") {
      setSelectedPlatforms(["twitter"]);
      setCategory("tweet_update");
      setTitle("");
      setContentText("Excited to roll out our brand new automated multi-platform scheduler! Now publishing daily to Google Page, YouTube, and X simultaneously 🚀");
      setMediaUrl("");
      setIsRecurring(false);
    } else {
      setSelectedPlatforms(["google_business", "youtube", "twitter", "facebook", "instagram"]);
      setCategory("general");
      setTitle("Weekend Festive Mega Sale Live Across All Branches!");
      setContentText("Visit us this Saturday & Sunday for up to 40% off on all items! Exclusive rewards for loyalty club members.");
      setMediaUrl("https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80");
      setIsRecurring(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await socialMediaApi.createScheduledPost({
        target_platforms: selectedPlatforms,
        title: title.trim() || undefined,
        content_text: contentText.trim(),
        media_urls: mediaUrl ? [mediaUrl.trim()] : [],
        thumbnail_url: thumbnailUrl.trim() || undefined,
        scheduled_for: new Date(scheduledDate).toISOString(),
        is_recurring: isRecurring,
        recurrence_cadence: isRecurring ? recurrenceCadence : undefined,
        recurrence_time: isRecurring ? scheduledDate.slice(11, 16) : undefined,
        category,
        tags,
      });

      toast.success("Post successfully scheduled to content queue!");
      setIsModalOpen(false);
      await fetchPosts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to schedule post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      await socialMediaApi.publishNow(id);
      toast.success("Published post instantly across connected platforms!");
      await fetchPosts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish post: Check connected channel settings");
      await fetchPosts();
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and remove this scheduled post?")) return;
    try {
      await socialMediaApi.deleteScheduledPost(id);
      toast.success("Removed scheduled post");
      await fetchPosts();
    } catch (err) {
      toast.error("Failed to delete post");
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === "scheduled") return p.status === "scheduled";
    if (activeFilter === "published") return p.status === "published";
    if (activeFilter === "google_seo") return p.category === "seo_photo";
    if (activeFilter === "youtube") return p.target_platforms.includes("youtube");
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls & Automation Starters */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar className="size-5 text-fuchsia-600" />
            Social Content Calendar & Automation Engine
          </h3>
          <p className="text-xs text-slate-500">
            Automate daily Google SEO photo drops, schedule YouTube video releases, and post cross-channel tweets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => setIsBatchModalOpen(true)}
            className="px-3.5 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            title="Upload 7 images to queue daily drops across the upcoming week"
          >
            <Layers className="size-4" />
            <span>⚡ 7-Day Batch SEO Photos</span>
          </button>

          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => openSchedulerModal("google_seo")}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Globe className="size-4 text-emerald-600" />
            <span>+ Single SEO Photo</span>
          </button>

          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => openSchedulerModal("youtube")}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Video className="size-4 text-rose-600" />
            <span>+ YouTube Video Drop</span>
          </button>

          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => openSchedulerModal("twitter")}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span className="font-black text-sm">𝕏</span>
            <span>+ Schedule Tweet</span>
          </button>

          <button
            type="button"
            disabled={!canSchedule}
            onClick={() => openSchedulerModal("multi")}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="size-4" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: "all", label: "All Posts" },
          { id: "scheduled", label: "Scheduled & Queue" },
          { id: "google_seo", label: "Google SEO Photos" },
          { id: "youtube", label: "YouTube Videos" },
          { id: "published", label: "Published Logs" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeFilter === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts List / Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Loader2 className="size-8 animate-spin mx-auto mb-2 text-fuchsia-600" />
          <p className="text-xs">Loading social content calendar...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <Calendar className="size-12 mx-auto text-slate-300" />
          <h4 className="font-bold text-slate-800 text-sm">No scheduled posts found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Set up daily SEO image posting for Google Business Profile or schedule YouTube video releases to build an automated content calendar.
          </p>
          <div className="pt-2">
            <button
              onClick={() => openSchedulerModal("google_seo")}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-fuchsia-600 transition cursor-pointer"
            >
              Setup First Schedule
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPosts.map((post) => {
            const isGoogleSeo = post.category === "seo_photo";
            const isYt = post.target_platforms.includes("youtube");
            const isTwitter = post.target_platforms.includes("twitter");

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  {/* Media Preview Header */}
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="relative h-44 bg-slate-100 overflow-hidden group">
                      <img
                        src={post.thumbnail_url || post.media_urls[0]}
                        alt={post.title || "Post Media"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isYt && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="size-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg">
                            <Play className="size-5 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        {post.target_platforms.map((plat) => (
                          <span
                            key={plat}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white shadow-xs ${
                              plat === "google_business"
                                ? "bg-emerald-600"
                                : plat === "youtube"
                                ? "bg-rose-600"
                                : plat === "twitter"
                                ? "bg-slate-900"
                                : "bg-fuchsia-600"
                            }`}
                          >
                            {plat === "google_business" ? "Google SEO" : plat}
                          </span>
                        ))}
                      </div>
                      {post.is_recurring && (
                        <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Repeat className="size-3" />
                          <span>{post.recurrence_cadence || "Daily"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock className="size-3.5 text-slate-400" />
                        {new Date(post.scheduled_for).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          post.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : post.status === "failed"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>

                    {post.title && <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{post.title}</h4>}
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{post.content_text}</p>

                    {/* Publication Error Details */}
                    {post.error_message && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-relaxed flex items-start gap-2">
                        <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <strong className="block font-bold text-rose-900">Publication Failed:</strong>
                          <span>{post.error_message}</span>
                        </div>
                      </div>
                    )}

                    {/* Live Platform Permalinks */}
                    {post.platform_post_ids && Object.keys(post.platform_post_ids).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(post.platform_post_ids).map(([plat, url]) => (
                          <a
                            key={plat}
                            href={String(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-700 hover:text-fuchsia-900 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 px-2 py-0.5 rounded-md transition"
                          >
                            <ExternalLink className="size-3" />
                            View on {plat === "google_business" ? "Google" : plat}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {post.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] font-mono text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  {post.status !== "published" ? (
                    <button
                      type="button"
                      disabled={!canSchedule}
                      onClick={() => handlePublishNow(post.id)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-fuchsia-300 text-slate-700 hover:text-fuchsia-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Send className="size-3" />
                      {post.status === "failed" ? "Retry Publish" : "Publish Now"}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Published
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={!canSchedule}
                    onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scheduler Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-fuchsia-100 text-fuchsia-700">
                  {modalType === "google_seo" ? (
                    <Globe className="size-5" />
                  ) : modalType === "youtube" ? (
                    <Video className="size-5" />
                  ) : (
                    <Calendar className="size-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {modalType === "google_seo"
                      ? "Daily Google Business SEO Image Scheduler"
                      : modalType === "youtube"
                      ? "YouTube Video & Shorts Scheduler"
                      : "Schedule Social Media Post"}
                  </h3>
                  <p className="text-[11px] text-slate-500">Configure target channels, publishing dates, and media assets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Target Platforms Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Channels *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "facebook", label: "Facebook Page", icon: Share2, channelKey: "meta" },
                    { id: "instagram", label: "Instagram", icon: ImageIcon, channelKey: "meta" },
                    { id: "google_business", label: "Google Business (SEO)", icon: Globe, channelKey: "google_business" },
                    { id: "youtube", label: "YouTube", icon: Video, channelKey: "youtube" },
                    { id: "twitter", label: "X (Twitter)", icon: Share2, channelKey: "twitter" },
                  ].map((plat) => {
                    const isSelected = selectedPlatforms.includes(plat.id);
                    const isConnected = channelsHealth ? channelsHealth[plat.channelKey]?.status === "connected" : false;
                    return (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedPlatforms.length > 1) {
                              setSelectedPlatforms(selectedPlatforms.filter((p) => p !== plat.id));
                            }
                          } else {
                            setSelectedPlatforms([...selectedPlatforms, plat.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <plat.icon className="size-3.5" />
                        <span>{plat.label}</span>
                        <span
                          className={`size-2 rounded-full ${
                            isConnected ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                          title={isConnected ? "Channel Connected" : "Channel Not Connected - Configure in Settings"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title (for YouTube or Google) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title / Headline {selectedPlatforms.includes("youtube") ? "*" : "(Optional)"}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. In-Store Launch Event or Video Title"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
              </div>

              {/* Content Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Caption / Description / Tweet Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="Write your post caption with keywords, promotional offers, and CTA..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
                {selectedPlatforms.includes("twitter") && (
                  <p className="text-[10px] text-slate-400 text-right mt-0.5">
                    Characters: {contentText.length}/280
                  </p>
                )}
              </div>

              {/* Media URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Image or Video URL {selectedPlatforms.includes("google_business") || selectedPlatforms.includes("youtube") ? "*" : "(Optional)"}
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://... (Direct image or mp4 video link)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
              </div>

              {/* Thumbnail URL (if YouTube) */}
              {selectedPlatforms.includes("youtube") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custom Thumbnail Image URL (Optional)</label>
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://... (16:9 thumbnail)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                  />
                </div>
              )}

              {/* Date & Time Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Publish Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. SEO, StoreLaunch, Deal"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Recurring Cadence Toggle (especially for Google SEO photo updates) */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Repeat className="size-3.5 text-fuchsia-600" />
                      Recurring Daily Automation Cadence
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Repeats automatically at this exact time to maintain continuous Google SEO activity.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="size-4 accent-fuchsia-600 rounded cursor-pointer"
                  />
                </div>

                {isRecurring && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-600">Frequency:</label>
                    <select
                      value={recurrenceCadence}
                      onChange={(e) => setRecurrenceCadence(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="daily">Every Day (Daily 10:00 AM)</option>
                      <option value="weekdays">Weekdays Only (Mon-Fri)</option>
                      <option value="weekly">Once Weekly</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save to Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7-Day Batch SEO Photo Scheduler Modal */}
      <BatchSeoPhotoSchedulerModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={fetchPosts}
        channelsHealth={channelsHealth}
      />
    </div>
  );
}
