/**
 * Customers & CRM Microservice Client (Native Fetch).
 *
 * Microservice: customers (:8109) via API Gateway (:8000)
 * Mount: /api/v1/customers
 */

import { apiClient } from "../lib/api-client";

export interface Customer {
  id: string;
  tenant_id?: string;
  outlet_id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  tags?: string[];
  status?: "active" | "vip" | "blacklisted" | "archived";
  total_visits: number;
  total_spent: number;
  last_visit_at?: string;
  loyalty_points?: number; // Calculated or stored
  created_at?: string;
}

export interface CustomerVisit {
  id: string;
  customer_id: string;
  bill_id?: string;
  order_id?: string;
  amount: number;
  covers: number;
  visited_at: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  outlet_id?: string;
  tags?: string[];
}

export const customerService = {
  async getCustomers(search?: string, limit = 50): Promise<Customer[]> {
    return apiClient.get<Customer[]>("/api/v1/customers/customers", {
      params: { search, limit },
    });
  },

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      return await apiClient.get<Customer>(`/api/v1/customers/customers/phone/${cleanPhone}`);
    } catch {
      return null;
    }
  },

  async createCustomer(data: CreateCustomerPayload): Promise<Customer> {
    return apiClient.post<Customer>("/api/v1/customers/customers", data);
  },

  async getCustomer(customerId: string): Promise<Customer> {
    return apiClient.get<Customer>(`/api/v1/customers/customers/${customerId}`);
  },

  async getCustomerVisits(customerId: string): Promise<CustomerVisit[]> {
    return apiClient.get<CustomerVisit[]>(`/api/v1/customers/customers/${customerId}/visits`);
  },
};
