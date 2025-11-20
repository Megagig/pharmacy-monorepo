import apiClient from './apiClient';

export interface PricingPlan {
  _id: string;
  name: string;
  slug: string;
  tier: string;
  price: number;
  billingPeriod: string;
  features: string[];
  featureCount: number;
  isActive: boolean;
  isPopular: boolean;
  order: number;
}

export interface SyncResult {
  plansUpdated?: number;
  plansFailed?: number;
  subscriptionsUpdated?: number;
  subscriptionsFailed?: number;
  subscriptionsFixed?: number;
  totalSubscriptions?: number;
  errors?: string[];
}

class PricingPlanService {
  /**
   * Get all pricing plans with their features
   */
  async getAllPlans(): Promise<PricingPlan[]> {
    const response = await apiClient.get('/admin/pricing-plans');
    return response.data.data;
  }

  /**
   * Get a single pricing plan by ID
   */
  async getPlanById(planId: string): Promise<PricingPlan> {
    const response = await apiClient.get(`/admin/pricing-plans/${planId}`);
    return response.data.data;
  }

  /**
   * Update pricing plan features
   */
  async updatePlanFeatures(planId: string, features: string[]): Promise<PricingPlan> {
    const response = await apiClient.put(`/admin/pricing-plans/${planId}/features`, { features });
    return response.data.data;
  }

  /**
   * Sync all pricing plans with current feature flags
   */
  async syncAllPlans(): Promise<{ success: boolean; data: SyncResult; message: string }> {
    const response = await apiClient.post('/admin/pricing-plans/sync');
    return response.data;
  }

  /**
   * Validate and fix all subscription planId references
   */
  async validateSubscriptions(): Promise<{ success: boolean; data: SyncResult; message: string }> {
    const response = await apiClient.post('/admin/pricing-plans/validate-subscriptions');
    return response.data;
  }

  /**
   * Update pricing plan details
   */
  async updatePlan(planId: string, data: Partial<PricingPlan>): Promise<PricingPlan> {
    const response = await apiClient.put(`/admin/pricing-plans/${planId}`, data);
    return response.data.data;
  }

  /**
   * Create a new pricing plan
   */
  async createPlan(data: Partial<PricingPlan>): Promise<PricingPlan> {
    const response = await apiClient.post('/admin/pricing-plans', data);
    return response.data.data;
  }
}

export default new PricingPlanService();
