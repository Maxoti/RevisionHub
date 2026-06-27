export type Curriculum = 'CBC' | '844';
export type ExamType = 'Opener' | 'Mid Term' | 'End Term';
export type Term = '1' | '2' | '3';

export interface Paper {
  id: number;
  title: string;
  curriculum: Curriculum;
  grade: string;           // "PP1" | "PP2" | "Grade 1"..."Grade 10" | "Form 1"..."Form 4"
  subject: string | null;  // null when is_bundle = true
  exam_type: ExamType;
  term: Term;
  year: number;
  price: number;
  is_bundle: boolean;
}

export type PurchaseStatus = 'pending' | 'completed' | 'failed';

export interface PurchaseStatusResponse {
  status: PurchaseStatus;
  download_token: string | null;
}

export interface CreatePurchaseResponse {
  purchase_id: number;
  message: string;
}

// Filter state used by the browse page
export interface PaperFilters {
  curriculum: Curriculum | '';
  grade: string;
  exam_type: ExamType | '';
  term: Term | '';
  year: string;
}