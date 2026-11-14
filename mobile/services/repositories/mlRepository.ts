/**
 * @file mlRepository.ts
 * @description Encapsulated repository for Machine Learning inference, health monitoring,
 * and automated transaction enrichment operations.
 * Adheres to Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP).
 */

import { apiRequest } from '../api';

export interface MlHealthResponse {
  status: string;
  active_model?: string;
  model_revision?: string;
  auxiliary_models?: Record<
    string,
    {
      status: string;
      model_type?: string;
      algorithm?: string;
      version?: string;
      metrics?: Record<string, any>;
      [key: string]: any;
    }
  >;
  [key: string]: any;
}

export interface MlClassificationPrediction {
  category: string;
  confidence: number;
  model_revision?: string;
}

export interface MlClassificationResponse {
  predictions: MlClassificationPrediction[];
  fallback_used?: boolean;
}

export interface MlMerchantMatchResponse {
  canonical_merchant?: string;
  merchant?: string;
  confidence?: number;
  matches?: Array<{ merchant: string; similarity: number; category?: string }>;
  [key: string]: any;
}

export interface MlDuplicateCheckResponse {
  is_duplicate: boolean;
  similarity_score: number;
  confidence: number;
  [key: string]: any;
}

export interface MlAnomalyScoreResponse {
  is_anomaly: boolean;
  anomaly_score: number;
  z_score: number;
  results?: Array<{ is_anomaly: boolean; anomaly_score: number; z_score: number }>;
  [key: string]: any;
}

export interface MlForecastResponse {
  horizon_days?: number;
  forecast?: Array<{ day: number; predicted_amount: number; lower_bound?: number; upper_bound?: number }>;
  total_projected?: number;
  [key: string]: any;
}

export const mlRepository = {
  /**
   * Fetches real-time ML engine operational status and loaded model telemetry.
   */
  async getHealth(): Promise<MlHealthResponse> {
    try {
      return await apiRequest<MlHealthResponse>('/ml/health');
    } catch {
      return {
        status: 'offline',
        active_model: 'Category Classifier (Offline)',
        model_revision: 'v2.5.0',
        auxiliary_models: {},
      };
    }
  },

  /**
   * Classifies an expense or SMS narrative into a financial category.
   */
  async classify(description: string, topN = 3): Promise<MlClassificationResponse> {
    return apiRequest<MlClassificationResponse>('/ml/classify', {
      method: 'POST',
      body: JSON.stringify({ description, top_n: topN }),
    });
  },

  /**
   * Resolves a noisy raw merchant string to a clean canonical merchant entity.
   */
  async matchMerchant(rawMerchant: string, topK = 5): Promise<MlMerchantMatchResponse> {
    return apiRequest<MlMerchantMatchResponse>('/ml/merchants/match', {
      method: 'POST',
      body: JSON.stringify({ raw_merchant: rawMerchant, top_k: topK }),
    });
  },

  /**
   * Checks whether two candidate transactions constitute a duplicate charge.
   */
  async checkDuplicates(candidateA: any, candidateB: any): Promise<MlDuplicateCheckResponse> {
    return apiRequest<MlDuplicateCheckResponse>('/ml/duplicates/check', {
      method: 'POST',
      body: JSON.stringify({ candidate_a: candidateA, candidate_b: candidateB }),
    });
  },

  /**
   * Evaluates anomalous spending behavior for a set of transaction records.
   */
  async scoreAnomalies(transactions: any[]): Promise<MlAnomalyScoreResponse> {
    return apiRequest<MlAnomalyScoreResponse>('/ml/anomalies/score', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    });
  },

  /**
   * Generates a multi-day spending forecast from historical daily aggregates.
   */
  async forecastSpending(dailyAmounts: number[], horizonDays = 30): Promise<MlForecastResponse> {
    return apiRequest<MlForecastResponse>('/ml/forecast/spending', {
      method: 'POST',
      body: JSON.stringify({ daily_amounts: dailyAmounts, horizon_days: horizonDays }),
    });
  },
};
