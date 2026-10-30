import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BadgePercent,
  ImagePlus,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  marketingService,
  type MarketingAudienceType,
  type MarketingBanner,
  type MarketingCampaign,
  type MarketingReview,
  type ReviewSummary,
} from "@/services/marketingService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing, Banners & Reviews — RestaurantOS" },
      {
        name: "description",
        content:
          "Campaigns across SMS/WhatsApp/Email, banner management, and customer review handling.",
      },
    ],
  }),
  component: MarketingPage,
});

const campaignTone: Record<string, Tone> = {
  DRAFT: "neutral",
  ACTIVE: "info",
  SENT: "success",
  ARCHIVED: "neutral",
};

function MarketingPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [banners, setBanners] = useState<MarketingBanner[]>([]);
  const [reviews, setReviews] = useState<MarketingReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [campaignOpen, setCampaignOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MarketingReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [c, b, r, s] = await Promise.all([
        marketingService.getCampaigns(),
        marketingService.getBanners(),
        marketingService.getReviews(),
        marketingService.getReviewSummary().catch(() => null),
      ]);
      setCampaigns(c);
      setBanners(b);
      setReviews(r);
      setSummary(s);
    } catch (e) {
      console.warn("Marketing service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const replyQueue = useMemo(() => reviews.filter((r) => !r.is_replied), [reviews]);

  const sendCampaign = async (id: string) => {
    setBusy(true);
    try {
      const res = await marketingService.sendCampaign(id);
      toast.success(`Campaign sent to ${res.sent_count} recipient(s)`, {
        description: `Status: ${res.status}`,
      });
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async () => {
    if (!replyTarget || !replyText.trim()) {
      toast.error("Write a reply before submitting");
      return;
    }
    setBusy(true);
    try {
      await marketingService.replyReview(replyTarget.id, replyText.trim());
      toast.success("Reply posted to review");
      setReplyTarget(null);
      setReplyText("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Restaurant Vertical · Growth"
        title="Marketing, Banners & Reviews"
        description="Run targeted campaigns, manage in-app banners, and answer customer reviews."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCampaignOpen(true)}>
              <Plus className="size-3.5" /> New campaign
            </Button>
          </>
        }
      />

      {/* Reviews summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total reviews"
          value={String(summary?.count ?? "—")}
          icon={<MessageSquare />}
        />
        <KpiCard
          label="Average rating"
          value={
            summary?.average_rating != null
              ? `${summary.average_rating.toFixed(1)} ★`
              : "—"
          }
          icon={<Star />}
          sub={summary?.average_rating != null ? "out of 5" : undefined}
        />
        <KpiCard
          label="Awaiting a reply"
          value={String(summary?.unreplied ?? replyQueue.length)}
          icon={<Megaphone />}
          sub="open reply queue"
        />
      </div>

      <Tabs defaultValue="campaigns" className="space-y-5">
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs font-semibold">
            <Megaphone className="size-3.5" /> Campaigns ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5 text-xs font-semibold">
            <ImagePlus className="size-3.5" /> Banners ({banners.length})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5 text-xs font-semibold">
            <MessageSquare className="size-3.5" /> Reviews ({replyQueue.length} to answer)
          </TabsTrigger>
        </TabsList>

        {/* ── Campaigns ── */}
        <TabsContent value="campaigns">
          <Panel
            title="Campaigns"
            subtitle="SMS / WhatsApp / Email blasts with audience targeting and optional coupon."
          >
            <div className="space-y-2">
              {campaigns.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  No campaigns yet — create one to reach your audience.
                </div>
              ) : (
                campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ai/10 text-ai">
                      <Megaphone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {c.name}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {c.channel}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {((c.audience && (c.audience["type"] as string | undefined)) || "all")} audience
                        {c.coupon_ref ? ` · coupon ${c.coupon_ref}` : ""} · {c.message}
                      </div>
                    </div>
                    <StatusBadge
                      status={c.status}
                      tone={campaignTone[c.status] ?? "neutral"}
                    />
                    <span className="text-xs text-muted-foreground tabular">
                      {c.sent_count} sent
                    </span>
                    {(c.status === "DRAFT" || c.status === "ACTIVE") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void sendCampaign(c.id)}
                      >
                        <Send className="size-3.5" /> Send
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* ── Banners ── */}
        <TabsContent value="banners">
          <Panel
            title="Banners"
            subtitle="In-app promotional banners, with active state and display order."
            action={
              <Button size="sm" variant="outline" onClick={() => setBannerOpen(true)}>
                <Plus className="size-3.5" /> Add banner
              </Button>
            }
          >
            <div className="space-y-2">
              {banners.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  No banners configured.
                </div>
              ) : (
                banners
                  .slice()
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-card p-3",
                        !b.is_active && "opacity-60"
                      )}
                    >
                      <img
                        src={b.image_url}
                        alt={b.title || "banner"}
                        className="h-10 w-24 shrink-0 rounded object-cover ring-1 ring-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{b.title || "Untitled banner"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          display order {b.display_order}
                          {b.end_at ? ` · ends ${new Date(b.end_at).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <StatusBadge
                        status={b.is_active ? "ACTIVE" : "INACTIVE"}
                        tone={b.is_active ? "success" : "neutral"}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => void toggleBanner(b)}
                      >
                        {b.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-critical"
                        onClick={() => void removeBanner(b)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* ── Reviews ── */}
        <TabsContent value="reviews">
          <Panel
            title="Customer reviews"
            subtitle="Reply queue — answer the reviews that are still open."
          >
            <div className="space-y-2">
              {reviews.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  No reviews yet.
                </div>
              ) : (
                reviews
                  .slice()
                  .sort((a, b) => Number(a.is_replied) - Number(b.is_replied))
                  .map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-lg border bg-card p-3",
                        !r.is_replied && "border-primary/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-xs">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "size-3.5",
                                  i < r.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/40"
                                )}
                              />
                            ))}
                            <span className="ml-1 text-muted-foreground">
                              {new Date(r.at || r.created_at).toLocaleDateString()}
                              {r.order_ref ? ` · ${r.order_ref}` : ""}
                            </span>
                          </div>
                          {r.comment && (
                            <div className="mt-1 text-sm text-foreground">{r.comment}</div>
                          )}
                          {r.is_replied && (
                            <div className="mt-1.5 rounded bg-surface p-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Your reply:</span>{" "}
                              {r.reply_text}
                            </div>
                          )}
                        </div>
                        {r.is_replied ? (
                          <StatusBadge status="REPLIED" tone="success" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReplyTarget(r);
                              setReplyText("");
                            }}
                          >
                            <Pencil className="size-3.5" /> Reply
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      {/* New campaign dialog */}
      <CampaignDialog
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        onCreated={() => {
          setCampaignOpen(false);
          void reload();
        }}
      />

      {/* New banner dialog */}
      <BannerDialog
        open={bannerOpen}
        onClose={() => setBannerOpen(false)}
        onCreated={() => {
          setBannerOpen(false);
          void reload();
        }}
      />

      {/* Reply composer */}
      <Dialog open={!!replyTarget} onOpenChange={(o) => !o && setReplyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> Reply to review
            </DialogTitle>
            <DialogDescription>
              {replyTarget?.comment || "(no comment)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label className="text-xs font-semibold">Your public reply</Label>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              placeholder="Thanks for the feedback! We'd love to make it up to you…"
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || !replyText.trim()} onClick={() => void submitReply()}>
              <Send className="size-3.5" /> Post reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );

  async function toggleBanner(b: MarketingBanner) {
    try {
      setBusy(true);
      await marketingService.updateBanner(b.id, { is_active: !b.is_active });
      toast.success(`Banner ${b.is_active ? "deactivated" : "activated"}`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update banner");
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner(b: MarketingBanner) {
    // Banner removal = deactivate (no DELETE route in the contract).
    try {
      setBusy(true);
      if (b.is_active) {
        await marketingService.updateBanner(b.id, { is_active: false });
      }
      toast.success("Banner removed (deactivated)");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove banner");
    } finally {
      setBusy(false);
    }
  }
}

// ── New campaign form ────────────────────────────────────────────────────────

function CampaignDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"SMS" | "WHATSAPP" | "EMAIL">("SMS");
  const [audience, setAudience] = useState<MarketingAudienceType>("all");
  const [message, setMessage] = useState("");
  const [coupon, setCoupon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setChannel("SMS");
      setAudience("all");
      setMessage("");
      setCoupon("");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !message.trim()) {
      toast.error("Campaign name and message are required");
      return;
    }
    setSaving(true);
    try {
      await marketingService.createCampaign({
        name: name.trim(),
        channel,
        audience: { type: audience },
        message: message.trim(),
        coupon_ref: coupon.trim() || null,
      });
      toast.success(`Campaign "${name.trim()}" created (DRAFT)`);
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" /> New campaign
          </DialogTitle>
          <DialogDescription>Pick a channel, an audience, and a message.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Campaign name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend thali offer" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as "SMS" | "WHATSAPP" | "EMAIL")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as MarketingAudienceType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  <SelectItem value="segment">Segment</SelectItem>
                  <SelectItem value="new">New customers</SelectItem>
                  <SelectItem value="repeat">Repeat customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Message *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi {{name}}, 20% off this weekend with code THALI20!"
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Coupon code (optional)</Label>
            <div className="flex items-center gap-2">
              <BadgePercent className="size-4 text-muted-foreground" />
              <Input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="THALI20"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Plus className="size-3.5" /> Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── New banner form ──────────────────────────────────────────────────────────

function BannerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setImageUrl("");
      setTitle("");
      setOrder("0");
    }
  }, [open]);

  const submit = async () => {
    if (!imageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }
    setSaving(true);
    try {
      await marketingService.createBanner({
        image_url: imageUrl.trim(),
        title: title.trim() || null,
        display_order: parseInt(order) || 0,
      });
      toast.success("Banner created");
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="size-4 text-primary" /> New banner
          </DialogTitle>
          <DialogDescription>Link an image and set its display order.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Image URL *</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/banner.png"
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Display order</Label>
              <Input
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                type="number"
                min="0"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Plus className="size-3.5" /> Add banner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
