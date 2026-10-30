/**
 * Marketing Service Client (Native Fetch).
 *
 * Microservice: marketing via API Gateway (:8000)
 * Mount: /api/v1/marketing
 *
 * Routes: /campaigns, /campaigns/{id}/recipients, /campaigns/{id}/send,
 *         /banners, /reviews, /reviews/summary, /reviews/{id}/reply
 */

import { apiClient } from "../lib/api-client";

// ── Campaigns ────────────────────────────────────────────────────────────────

export type MarketingChannel = "SMS" | "WHATSAPP" | "EMAIL";
/** Audience types: all / segment / new / repeat (criteria is open-ended JSON). */
export type MarketingAudienceType = "all" | "segment" | "new" | "repeat";

export interface MarketingCampaign {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  name: string;
  channel: MarketingChannel | string;
  audience: Record<string, unknown>;
  message: string;
  coupon_ref?: string | null;
  schedule_at?: string | null;
  status: string; // DRAFT | ACTIVE | SENT | ARCHIVED
  sent_count: number;
  created_by?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignPayload {
  name: string;
  channel?: MarketingChannel | string;
  audience?: Record<string, unknown>;
  message: string;
  coupon_ref?: string | null;
  schedule_at?: string | null;
  outlet_id?: string | null;
  status?: "DRAFT" | "ACTIVE";
}

export type UpdateCampaignPayload = Partial<CreateCampaignPayload> & {
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

export interface CampaignSendResult {
  campaign_id: string;
  status: string;
  sent_count: number;
  recipients_finalized: number;
}

export interface MarketingRecipient {
  id: string;
  campaign_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  segment?: string | null;
  status: string;
  sent_at?: string | null;
  error?: string | null;
  created_at: string;
}

// ── Banners ──────────────────────────────────────────────────────────────────

export interface MarketingBanner {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  image_url: string;
  title?: string | null;
  is_active: boolean;
  display_order: number;
  start_at?: string | null;
  end_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerPayload {
  image_url: string;
  title?: string | null;
  outlet_id?: string | null;
  is_active?: boolean;
  display_order?: number;
  start_at?: string | null;
  end_at?: string | null;
}

export type UpdateBannerPayload = Partial<CreateBannerPayload>;

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface MarketingReview {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  customer_id: string;
  order_ref?: string | null;
  rating: number;
  comment?: string | null;
  is_replied: boolean;
  reply_text?: string | null;
  at: string;
  created_at: string;
}

export interface ReviewSummary {
  count: number;
  average_rating?: number | null;
  unreplied: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const marketingService = {
  // Campaigns
  async getCampaigns(params: {
    status?: string;
    outletId?: string;
  } = {}): Promise<MarketingCampaign[]> {
    return apiClient.get<MarketingCampaign[]>("/api/v1/marketing/campaigns", {
      params: {
        status: params.status,
        outlet_id: params.outletId,
      },
    });
  },

  async createCampaign(data: CreateCampaignPayload): Promise<MarketingCampaign> {
    return apiClient.post<MarketingCampaign>("/api/v1/marketing/campaigns", data);
  },

  async updateCampaign(
    campaignId: string,
    data: UpdateCampaignPayload
  ): Promise<MarketingCampaign> {
    return apiClient.patch<MarketingCampaign>(
      `/api/v1/marketing/campaigns/${campaignId}`,
      data
    );
  },

  async getCampaignRecipients(
    campaignId: string,
    limit = 100
  ): Promise<MarketingRecipient[]> {
    return apiClient.get<MarketingRecipient[]>(
      `/api/v1/marketing/campaigns/${campaignId}/recipients`,
      { params: { limit } }
    );
  },

  /**
   * Preload recipient lists (fetched by the caller from the customers
   * service) — marketing never cross-reads the customers DB.
   */
  async preloadRecipients(
    campaignId: string,
    recipients: {
      customer_id: string;
      name: string;
      phone?: string | null;
      segment?: string | null;
    }[]
  ): Promise<{ campaign_id: string; added: number; total: number }> {
    return apiClient.post<{ campaign_id: string; added: number; total: number }>(
      `/api/v1/marketing/campaigns/${campaignId}/recipients`,
      { recipients }
    );
  },

  /** Finalize & dispatch: mark SENT and roll up the count. */
  async sendCampaign(campaignId: string): Promise<CampaignSendResult> {
    return apiClient.post<CampaignSendResult>(
      `/api/v1/marketing/campaigns/${campaignId}/send`,
      {}
    );
  },

  // Banners
  async getBanners(params: {
    outletId?: string;
    activeOnly?: boolean;
  } = {}): Promise<MarketingBanner[]> {
    return apiClient.get<MarketingBanner[]>("/api/v1/marketing/banners", {
      params: {
        outlet_id: params.outletId,
        active: params.activeOnly,
      },
    });
  },

  async createBanner(data: CreateBannerPayload): Promise<MarketingBanner> {
    return apiClient.post<MarketingBanner>("/api/v1/marketing/banners", data);
  },

  async updateBanner(
    bannerId: string,
    data: UpdateBannerPayload
  ): Promise<MarketingBanner> {
    return apiClient.patch<MarketingBanner>(
      `/api/v1/marketing/banners/${bannerId}`,
      data
    );
  },

  // Reviews
  async getReviews(params: {
    outletId?: string;
    rating?: number;
    unrepliedOnly?: boolean;
    limit?: number;
  } = {}): Promise<MarketingReview[]> {
    return apiClient.get<MarketingReview[]>("/api/v1/marketing/reviews", {
      params: {
        outlet_id: params.outletId,
        rating: params.rating,
        unreplied: params.unrepliedOnly,
        limit: params.limit || 100,
      },
    });
  },

  async getReviewSummary(outletId?: string): Promise<ReviewSummary> {
    return apiClient.get<ReviewSummary>("/api/v1/marketing/reviews/summary", {
      params: { outlet_id: outletId },
    });
  },

  async replyReview(
    reviewId: string,
    replyText: string
  ): Promise<MarketingReview> {
    return apiClient.post<MarketingReview>(
      `/api/v1/marketing/reviews/${reviewId}/reply`,
      { reply_text: replyText }
    );
  },
};
