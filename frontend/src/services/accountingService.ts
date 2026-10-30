/**
 * Accounting Service Client — finance operations (Native Fetch).
 *
 * Microservice: accounting (:8105) via API Gateway (:8000)
 * Mount: /api/v1/accounting
 *
 * Finance-ops surface (api_finance router):
 *   /expenses, /expense-categories, /withdrawals, /exchange-rates,
 *   /cash-flow/summary
 */

import { apiClient } from "../lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  gl_account_code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMode = "CASH" | "CARD" | "BANK" | "UPI";

export interface Expense {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  expense_no: string;
  date: string;
  description?: string | null;
  category_id: string;
  payment_mode: PaymentMode | string;
  amount: number;
  paid_to?: string | null;
  posted: boolean;
  journal_entry_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type WithdrawalMethod = "CASH" | "BANK" | "UPI" | "CHEQUE";
export type WithdrawalStatus = "pending" | "approved" | "rejected";

export interface Withdrawal {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  date: string;
  amount: number;
  method: WithdrawalMethod | string;
  note?: string | null;
  status: WithdrawalStatus | string;
  approved_by?: string | null;
  journal_entry_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  tenant_id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_from: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Latest rate for a pair — ``available: false`` when none is effective yet. */
export interface CurrentExchangeRate extends ExchangeRate {
  available: boolean;
  reason?: string | null;
}

/** Trailing-window all-wallets cash-flow summary. */
export interface CashFlowSummary {
  days: number;
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
  daily: { date: string; in: number; out: number }[];
  by_payment_mode?: Record<string, number>;
  notes?: string[];
}

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateExpensePayload {
  outlet_id?: string | null;
  date?: string | null;
  description?: string | null;
  category_id: string;
  payment_mode: PaymentMode | string;
  amount: number;
  paid_to?: string | null;
}

export interface CreateWithdrawalPayload {
  outlet_id?: string | null;
  date?: string | null;
  amount: number;
  method: WithdrawalMethod | string;
  note?: string | null;
}

export interface CreateExchangeRatePayload {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_from: string;
  notes?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const accountingService = {
  // Expense categories
  async getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
    return apiClient.get<ExpenseCategory[]>("/api/v1/accounting/expense-categories", {
      params: { include_inactive: includeInactive },
    });
  },

  async createExpenseCategory(data: {
    code: string;
    name: string;
    gl_account_code?: string | null;
    is_active?: boolean;
  }): Promise<ExpenseCategory> {
    return apiClient.post<ExpenseCategory>("/api/v1/accounting/expense-categories", data);
  },

  // Expenses
  async getExpenses(params: {
    outletId?: string;
    categoryId?: string;
    paymentMode?: string;
    posted?: boolean;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<Expense[]> {
    return apiClient.get<Expense[]>("/api/v1/accounting/expenses", {
      params: {
        outlet_id: params.outletId,
        category_id: params.categoryId,
        payment_mode: params.paymentMode,
        posted: params.posted,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        limit: params.limit || 50,
      },
    });
  },

  async createExpense(data: CreateExpensePayload): Promise<Expense> {
    return apiClient.post<Expense>("/api/v1/accounting/expenses", data);
  },

  /** Post an unposted expense to the general ledger. */
  async postExpense(
    expenseId: string
  ): Promise<{ expense: Expense; posted: boolean; journal_entry_id?: string | null; message: string }> {
    return apiClient.post<{
      expense: Expense;
      posted: boolean;
      journal_entry_id?: string | null;
      message: string;
    }>(`/api/v1/accounting/expenses/${expenseId}/post`, {});
  },

  // Withdrawals
  async getWithdrawals(params: {
    outletId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<Withdrawal[]> {
    return apiClient.get<Withdrawal[]>("/api/v1/accounting/withdrawals", {
      params: {
        outlet_id: params.outletId,
        status: params.status,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        limit: params.limit || 50,
      },
    });
  },

  async createWithdrawal(data: CreateWithdrawalPayload): Promise<Withdrawal> {
    return apiClient.post<Withdrawal>("/api/v1/accounting/withdrawals", data);
  },

  async approveWithdrawal(
    withdrawalId: string
  ): Promise<{ message: string; withdrawal: Withdrawal }> {
    return apiClient.post<{ message: string; withdrawal: Withdrawal }>(
      `/api/v1/accounting/withdrawals/${withdrawalId}/approve`,
      {}
    );
  },

  async rejectWithdrawal(
    withdrawalId: string,
    reason?: string
  ): Promise<{ message: string; withdrawal: Withdrawal }> {
    return apiClient.post<{ message: string; withdrawal: Withdrawal }>(
      `/api/v1/accounting/withdrawals/${withdrawalId}/reject`,
      reason ? { reason } : {}
    );
  },

  // Exchange rates
  async getExchangeRates(params: {
    fromCurrency?: string;
    toCurrency?: string;
    limit?: number;
  } = {}): Promise<ExchangeRate[]> {
    return apiClient.get<ExchangeRate[]>("/api/v1/accounting/exchange-rates", {
      params: {
        from_currency: params.fromCurrency,
        to_currency: params.toCurrency,
        limit: params.limit || 100,
      },
    });
  },

  async createExchangeRate(data: CreateExchangeRatePayload): Promise<ExchangeRate> {
    return apiClient.post<ExchangeRate>("/api/v1/accounting/exchange-rates", data);
  },

  /** Latest effective rate for a pair — an ``available: false`` envelope, not a 404. */
  async getCurrentExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrentExchangeRate> {
    return apiClient.get<CurrentExchangeRate>(
      "/api/v1/accounting/exchange-rates/current",
      {
        params: {
          from_currency: fromCurrency,
          to_currency: toCurrency,
        },
      }
    );
  },

  // Cash-flow summary (in / out / net / balance over a trailing window)
  async getCashFlowSummary(days = 30, outletId?: string): Promise<CashFlowSummary> {
    return apiClient.get<CashFlowSummary>("/api/v1/accounting/cash-flow/summary", {
      params: { days, outlet_id: outletId },
    });
  },
};
