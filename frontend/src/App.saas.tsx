import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, Calendar, FileText, List } from 'lucide-react';
import type { Paper } from './types';
import PaperCard from './components/PaperCard.saas';
import FilterSelect from './components/FilterSelect';
import type { FilterOption } from './components/FilterSelect';
import SaasBuyModal from './components/SaasBuyModal';
// ---------------------------------------------------------------------------
// SaaS storefront (e.g. edusynchub.co.ke/jane).
// The premium single-tenant sites keep using App.tsx. Do not import this file
// from there. Filter types are local so ./types (shared) does not change.
// ---------------------------------------------------------------------------

const API_URL: string = import.meta.env.VITE_API_URL ?? '';

// Curriculum values must match what the admin upload form stores.
const CURRICULA = [
  { value: 'CBE', label: 'CBE' },
  { value: 'Cambridge', label: 'Cambridge' },
  { value: '8-4-4', label: '8-4-4' },
];

const GRADES_BY_CURRICULUM: Record<string, string[]> = {
  CBE: [
    'Playgroup', 'PP1', 'PP2',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  ],
  Cambridge: [
    'Nursery', 'Reception',
    'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
    'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13',
  ],
  '8-4-4': ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
};

const COMMON_TYPES = [
  'Revision Materials',
  'Topical Exams',
  'Mid-Term Exams',
  'End-Term Exams',
  'Opener Exams',
  'Mock Exams',
  'Weekly Exams',
  'Schemes of Work',
  'Lesson Plans',
  'Lesson Notes',
  'Mnemonic Songs',
  'Math Formulae',
];

const EXTRA_TYPES: Record<string, string[]> = {
  CBE: [
    'KPSEA (Grade 6)',
    'KJSEA (Grade 9)',
    'KCBE (Grade 12)',
    'County / Cluster Mocks',
    'Pre-Mocks',
    'Holiday Assignments',
  ],
  Cambridge: [
    'Cambridge Checkpoint (Year 6 / Year 9)',
    'IGCSE Past Papers',
    'IGCSE Mocks',
    'AS Level Past Papers',
    'AS Level Mocks',
    'A Level Past Papers',
    'A Level Mocks',
  ],
  '8-4-4': [],
};

const STANDARD_TERMS: [string, string][] = [['1', 'Term 1'], ['2', 'Term 2'], ['3', 'Term 3']];
const CAMBRIDGE_SERIES: [string, string][] = [
  ['May/June', 'May/June Series'],
  ['Oct/Nov', 'Oct/Nov Series'],
  ['Feb/March', 'Feb/March Series'],
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(String);

const ALL_GRADES = [...new Set(Object.values(GRADES_BY_CURRICULUM).flat())];

function typesFor(curriculum: string): string[] {
  if (!curriculum) return [...new Set([...COMMON_TYPES, ...Object.values(EXTRA_TYPES).flat()])];
  return [...COMMON_TYPES, ...(EXTRA_TYPES[curriculum] ?? [])];
}

function termsFor(curriculum: string): [string, string][] {
  if (curriculum === 'Cambridge') return [...STANDARD_TERMS, ...CAMBRIDGE_SERIES];
  if (!curriculum) return [...STANDARD_TERMS, ...CAMBRIDGE_SERIES];
  return STANDARD_TERMS;
}

const toOptions = (list: string[]): FilterOption[] =>
  list.map((v) => ({ value: v, label: v }));

interface Filters {
  curriculum: string;
  grade: string;
  exam_type: string;
  term: string;
  year: string;
}

const DEFAULT_FILTERS: Filters = { curriculum: '', grade: '', exam_type: '', term: '', year: '' };

interface StoreInfo {
  name: string;
  [key: string]: unknown;
}

type LoadState = 'loading' | 'ready' | 'error' | 'empty' | 'notfound';

// Page background: soft white-blue
const PAGE_BG = 'bg-gradient-to-b from-[#E6EFFF] via-[#EEF4FF] to-[#F7FAFF]';

export default function AppSaas() {
  const [papers, setPapers]               = useState<Paper[]>([]);
  const [store, setStore]                 = useState<StoreInfo | null>(null);
  const [purchasable, setPurchasable]     = useState(true);
  const [loadState, setLoadState]         = useState<LoadState>('loading');
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // First path segment is the store slug: /jane -> "jane"
  const slug = window.location.pathname.split('/').filter(Boolean)[0] ?? '';

  useEffect(() => {
    if (!slug) {
      setLoadState('notfound');
      return;
    }

    const controller = new AbortController();
    setLoadState('loading');

    const qs = new URLSearchParams();
    if (filters.curriculum) qs.set('curriculum', filters.curriculum);
    if (filters.grade)      qs.set('grade', filters.grade);
    if (filters.exam_type)  qs.set('type', filters.exam_type);
    if (filters.term)       qs.set('term', filters.term);
    if (filters.year)       qs.set('year', filters.year);

    fetch(`${API_URL}/api/store/${encodeURIComponent(slug)}/papers?${qs}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setLoadState('notfound');
          return;
        }
        if (!res.ok) throw new Error('load failed');
        const data = (await res.json()) as {
          store: StoreInfo;
          purchasable: boolean;
          papers: Paper[];
        };
        setStore(data.store);
        setPurchasable(Boolean(data.purchasable));
        setPapers(data.papers);
        setLoadState(data.papers.length === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadState('error');
      });

    // Ignore a slow earlier response if the filters changed again.
    return () => controller.abort();
  }, [slug, filters]);

  function setFilter(key: keyof Filters, value: string) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'curriculum') {
        // Reset anything that does not exist in the newly chosen curriculum.
        next.grade = '';
        if (next.exam_type && !typesFor(value).includes(next.exam_type)) next.exam_type = '';
        if (next.term && !termsFor(value).some(([v]) => v === next.term)) next.term = '';
      }
      return next;
    });
  }

  function handleSelect(paper: Paper) {
    // Buying is switched off until the seller's payments are ready.
    if (!purchasable) return;
    setSelectedPaper(paper);
  }

  const gradeOptions = GRADES_BY_CURRICULUM[filters.curriculum] ?? ALL_GRADES;
  const storeName = store?.name ?? '';
  const hasFilters = Object.values(filters).some(Boolean);

  if (loadState === 'notfound') {
    return (
      <div className={`flex min-h-screen items-center justify-center px-6 text-center ${PAGE_BG}`}>
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B2A7A]">Store not found</h1>
          <p className="mt-2 text-sm text-[#0B2A7A]/70">
            Check the link you were given and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col ${PAGE_BG}`}>
      {/* Header (store name comes from the slug) */}
      <header className="bg-[#1A56DB] text-white py-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1A56DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-white/70">
            Pay per download · No account needed
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold">
          {storeName || 'Exam Papers'}
        </h1>
        <p className="text-white/70 text-sm mt-3">
          CBE · Cambridge · 8-4-4 · Past Papers with Answers
        </p>
      </header>

      {/* Payments not ready */}
      {!purchasable && loadState === 'ready' && papers.length > 0 && (
        <div className="border-b border-blue-200 bg-blue-100 px-4 py-4">
          <div className="mx-auto flex max-w-6xl items-center gap-4">
            <svg
              viewBox="0 0 28 24"
              className="h-9 w-10 shrink-0 text-orange-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 11 18-5v12L3 14v-3z" fill="currentColor" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
              <path d="M23.5 9.5a4 4 0 0 1 0 5" />
              <path d="M26 7.5a7 7 0 0 1 0 9" />
            </svg>
            <span className="h-10 w-px shrink-0 bg-blue-900/50" aria-hidden="true" />
            <p className="text-sm font-bold leading-snug text-blue-900 sm:text-base">
              Thanks <span>{store?.name}</span> for uploading your first paper. For
              purchases in your store, please contact the system admin for M-Pesa
              integration.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <FilterSelect
            label="Curriculum"
            allLabel="All Curricula"
            Icon={BookOpen}
            value={filters.curriculum}
            onChange={(v: string) => setFilter('curriculum', v)}
            options={CURRICULA}
          />
          <FilterSelect
            label={filters.curriculum === 'Cambridge' ? 'Year' : 'Grade'}
            allLabel={filters.curriculum === 'Cambridge' ? 'All Years / Classes' : 'All Grades'}
            Icon={BarChart3}
            value={filters.grade}
            onChange={(v: string) => setFilter('grade', v)}
            options={toOptions(gradeOptions)}
          />
          <FilterSelect
            label="Type"
            allLabel="All Types"
            Icon={List}
            value={filters.exam_type}
            onChange={(v: string) => setFilter('exam_type', v)}
            options={toOptions(typesFor(filters.curriculum))}
          />
          <FilterSelect
            label="Term"
            allLabel="All Terms"
            Icon={FileText}
            value={filters.term}
            onChange={(v: string) => setFilter('term', v)}
            options={termsFor(filters.curriculum).map(([value, label]) => ({ value, label }))}
          />
          <FilterSelect
            label="Year"
            allLabel="All Years"
            Icon={Calendar}
            value={filters.year}
            onChange={(v: string) => setFilter('year', v)}
            options={toOptions(YEARS)}
          />
        </div>

        {hasFilters && (
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs font-medium text-[#0B2A7A]/70 underline hover:text-[#0B2A7A]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Paper grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loadState === 'loading' && (
          <p className="text-center text-[#0B2A7A]/60">Loading papers…</p>
        )}
        {loadState === 'error' && (
          <p className="text-center text-red-600">
            Could not load papers. Refresh to try again.
          </p>
        )}
        {loadState === 'empty' && (
          <p className="text-center text-[#0B2A7A]/60">
            No papers found for the selected filters.
          </p>
        )}
        {loadState === 'ready' && (
          <>
            <p className="mb-4 text-sm font-medium text-[#0B2A7A]/70" aria-live="polite">
              {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {papers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} onSelect={handleSelect} />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedPaper && (
        <SaasBuyModal
          paper={selectedPaper}
          slug={slug}
          whatsappNumber={typeof store?.whatsapp === 'string' ? store.whatsapp : undefined}
          onClose={() => setSelectedPaper(null)}
        />
      )}
    </div>
  );
}