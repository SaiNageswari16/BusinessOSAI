import React, { useState } from "react";
import {
  X,
  Upload,
  Calendar,
  Clock,
  Globe,
  Share2,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Layers,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { socialMediaApi } from "@/lib/api-client";

interface BatchSeoPhotoSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  channelsHealth: Record<string, { status: string; page?: string; handle?: string; channel?: string; location?: string }> | null;
}

export function BatchSeoPhotoSchedulerModal({
  isOpen,
  onClose,
  onSuccess,
  channelsHealth,
}: BatchSeoPhotoSchedulerModalProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["google_business"]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([
    "https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
  ]);
  const [newUrlInput, setNewUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [timeOfDay, setTimeOfDay] = useState("10:00");
  const [baseTitle, setBaseTitle] = useState("Daily Storefront & Inventory Highlight - Day {day}");
  const [captionTemplate, setCaptionTemplate] = useState(
    "Fresh in-stock arrivals ready at IoTRONCS Storefront! Open today from 9:00 AM to 10:00 PM. Visit us in-store or order online. #Storefront #Hyderabad #Retail #{date}"
  );
  const [tagsInput, setTagsInput] = useState("LocalSEO, GoogleMaps, Storefront, FreshInventory");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const res = await socialMediaApi.uploadMediaImages(Array.from(files));
      if (res && res.urls && res.urls.length > 0) {
        setMediaUrls((prev) => [...prev, ...res.urls]);
        toast.success(`Uploaded ${res.urls.length} images successfully!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload images");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleAddUrl = () => {
    if (!newUrlInput.trim()) return;
    setMediaUrls((prev) => [...prev, newUrlInput.trim()]);
    setNewUrlInput("");
  };

  const handleRemoveUrl = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaUrls.length === 0) {
      toast.error("Please add at least 1 image URL or upload photos.");
      return;
    }

    try {
      setIsSubmitting(true);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const startDateTime = new Date(`${startDate}T${timeOfDay}:00`);

      const res = await socialMediaApi.createBatchDailySchedule({
        target_platforms: selectedPlatforms,
        media_urls: mediaUrls,
        base_title: baseTitle.trim() || undefined,
        caption_template: captionTemplate.trim(),
        start_date: startDateTime.toISOString(),
        time_of_day: timeOfDay,
        category: "seo_photo",
        tags,
      });

      toast.success(`Successfully queued ${res.length} daily posts across next ${res.length} days!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create batch schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSchedule = mediaUrls.map((url, idx) => {
    const d = new Date(`${startDate}T${timeOfDay}:00`);
    d.setDate(d.getDate() + idx);
    return {
      day: idx + 1,
      dateString: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      url,
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-emerald-50/50 to-teal-50/30 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <span>⚡ 7-Day Batch SEO Photo Uploader</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Automated Daily Cadence
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Upload 7 photos to automatically queue 1 photo per day for the next 7 days on Google Maps & Search.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Channels */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Channels</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "google_business", label: "Google Business (SEO)", icon: Globe, key: "google_business" },
                { id: "facebook", label: "Facebook Page", icon: Share2, key: "meta" },
                { id: "instagram", label: "Instagram", icon: ImageIcon, key: "meta" },
              ].map((plat) => {
                const isSelected = selectedPlatforms.includes(plat.id);
                const isConn = channelsHealth ? channelsHealth[plat.key]?.status === "connected" : false;
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
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <plat.icon className="size-3.5" />
                    <span>{plat.label}</span>
                    <span
                      className={`size-2 rounded-full ${isConn ? "bg-emerald-400" : "bg-amber-400"}`}
                      title={isConn ? "Connected" : "Requires Authentication"}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Images Manager */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="size-4 text-emerald-600" />
                <span>Media Images for Daily Cadence ({mediaUrls.length} Photos Queued)</span>
              </label>

              {/* Upload Local Files Button */}
              <label className="px-3 py-1 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer">
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                <span>Upload Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quick Add by URL */}
            <div className="flex gap-2">
              <input
                type="url"
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                Add URL
              </button>
            </div>

            {/* Grid of Images with Day Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
              {previewSchedule.map((item, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-2xs"
                >
                  <img src={item.url} alt={`Day ${item.day}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                    Day {item.day}
                  </div>
                  <div className="absolute bottom-1 inset-x-1 bg-black/70 backdrop-blur-xs text-white text-[8px] font-semibold text-center truncate px-1 py-0.5 rounded">
                    {item.dateString}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveUrl(idx)}
                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Each image is scheduled sequentially 1 day apart. You can have 7 images for a full week of daily automated drops.
            </p>
          </div>

          {/* Schedule Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-500" />
                Start Date (Day 1)
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="size-3.5 text-slate-500" />
                Daily Publishing Time (Peak Morning Hour)
              </label>
              <input
                type="time"
                required
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Title Template */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Title Template (supports <code className="text-emerald-700 bg-emerald-50 px-1 rounded">&#123;day&#125;</code> and <code className="text-emerald-700 bg-emerald-50 px-1 rounded">&#123;date&#125;</code>)
            </label>
            <input
              type="text"
              value={baseTitle}
              onChange={(e) => setBaseTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          {/* Caption Template */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Base Caption Template * (supports <code className="text-emerald-700 bg-emerald-50 px-1 rounded">&#123;day&#125;</code> and <code className="text-emerald-700 bg-emerald-50 px-1 rounded">&#123;date&#125;</code>)
            </label>
            <textarea
              rows={3}
              required
              value={captionTemplate}
              onChange={(e) => setCaptionTemplate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          {/* Summary Box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
            <span className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Will generate {mediaUrls.length} individual scheduled posts spanning {startDate} to{" "}
              {previewSchedule[previewSchedule.length - 1]?.dateString || ""} at {timeOfDay} daily.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mediaUrls.length === 0}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              <span>Queue {mediaUrls.length} Days of Posts</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
