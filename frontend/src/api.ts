import axios from 'axios';
import type {
  Paper,
  PaperFilters,
  PurchaseStatusResponse,
  CreatePurchaseResponse,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const client = axios.create({ baseURL: BASE_URL });

export async function fetchPapers(filters?: Partial<PaperFilters>): Promise<Paper[]> {
  const params: Record<string, string> = {};
  if (filters?.curriculum) params.curriculum = filters.curriculum;
  if (filters?.grade)      params.grade      = filters.grade;
  if (filters?.exam_type)  params.exam_type  = filters.exam_type;
  if (filters?.term)       params.term       = filters.term;
  if (filters?.year)       params.year       = filters.year;
  const { data } = await client.get<Paper[]>('/papers', { params });
  return data;
}

export async function createPurchase(
  paperId: number,
  phone: string,
  email?: string
): Promise<CreatePurchaseResponse> {
  const { data } = await client.post<CreatePurchaseResponse>('/purchases', {
    paper_id: paperId,
    phone,
    email: email || undefined,
  });
  return data;
}

export async function getPurchaseStatus(
  purchaseId: number
): Promise<PurchaseStatusResponse> {
  const { data } = await client.get<PurchaseStatusResponse>(
    `/purchases/${purchaseId}/status`
  );
  return data;
}

export function downloadUrl(token: string): string {
  return `${BASE_URL}/download/${token}`;
}