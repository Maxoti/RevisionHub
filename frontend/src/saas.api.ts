import axios from 'axios';
import type { Paper, PaperFilters } from './types';

// Multi-tenant (EdusyncHub) API client. The single-tenant api.ts is untouched.
// VITE_API_URL must point at the API host, e.g. https://api.edusynchub.co.ke
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const client = axios.create({ baseURL: BASE_URL });

// ---------------------------------------------------------------------
// Types (SaaS-specific, so the shared types.ts does not change)
// ---------------------------------------------------------------------
export interface SaasStoreCatalog {
  store: { name: string; slug: string };
  purchasable: boolean;
  papers: Paper[];
}

export interface SaasCreatePurchaseResponse {
  purchase_id: string; // signed reference, not a number
  message: string;
}

export interface SaasPurchaseStatusResponse {
  status: 'pending' | 'completed' | 'failed';
  download_token: string | null;
}

// ---------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------
export async function fetchStorePapers(
  slug: string,
  filters?: Partial<PaperFilters>
): Promise<SaasStoreCatalog> {
  const params: Record<string, string> = {};
  if (filters?.curriculum) params.curriculum = filters.curriculum;
  if (filters?.grade) params.grade = filters.grade;
  if (filters?.exam_type) params.type = filters.exam_type; // server expects "type"
  if (filters?.term) params.term = filters.term;
  if (filters?.year) params.year = String(filters.year);

  const { data } = await client.get<SaasStoreCatalog>(
    `/store/${encodeURIComponent(slug)}/papers`,
    { params }
  );
  return data;
}

export async function createStorePurchase(
  slug: string,
  paperId: number,
  phone: string,
  email?: string
): Promise<SaasCreatePurchaseResponse> {
  const { data } = await client.post<SaasCreatePurchaseResponse>('/purchases', {
    slug,
    paper_id: paperId,
    phone,
    email: email || undefined,
  });
  return data;
}

export async function getStorePurchaseStatus(
  purchaseId: string
): Promise<SaasPurchaseStatusResponse> {
  const { data } = await client.get<SaasPurchaseStatusResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/status`
  );
  return data;
}

export function storeDownloadUrl(slug: string, token: string): string {
  return `${BASE_URL}/store/${encodeURIComponent(slug)}/download/${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------

// The server's own message (e.g. "This store is not accepting payments yet.")
// instead of axios's generic "Request failed with status code 404".
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverMsg = (err.response?.data as { error?: string } | undefined)?.error;
    if (serverMsg) return serverMsg;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Could not start payment. Try again.';
}

// True when the request never got a response (offline, timeout, dropped).
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}