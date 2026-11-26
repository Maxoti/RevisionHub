import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, Calendar, FileText, List } from 'lucide-react';
import type { Paper, PaperFilters, Curriculum, ExamType, Term } from './types';
import { fetchPapers } from './api';
import PaperCardV2 from './components/PaperCardV2';
import BuyModal from './components/BuyModal';
import revisionhub from './assets/revisionhub-robert-logo.png';
import FilterSelect from './components/FilterSelect';
import type { FilterOption } from './components/FilterSelect';

const CBE_GRADES  = ['PP1', 'PP2', 'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10'];
const FORM_GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
const EXAM_TYPES: ExamType[] = ['Opener', 'Mid Term', 'End Term', 'Weekly', 'Schemes of Work', 'Lesson Plans', 'Revision Materials'];
const TERMS: Term[] = ['1', '2', '3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(String);

const DEFAULT_FILTERS: PaperFilters = {
  curriculum: '',
  grade: '',
  exam_type: '',
  term: '',
  year: '',
};

const CURRICULA: FilterOption[] = [
  { value: 'CBE', label: 'CBE' },
  { value: '844', label: '8-4-4' },
];

const toOptions = (list: string[]): FilterOption[] =>
  list.map((v) => ({ value: v, label: v }));

const PAGE_BG = 'bg-gradient-to-b from-[#E6EFFF] via-[#EEF4FF] to-[#F7FAFF]';

type LoadState = 'loading' | 'ready' | 'error' | 'empty';

export default function AppRobert() {
  const [papers, setPapers]               = useState<Paper[]>([]);
  const [loadState, setLoadState]         = useState<LoadState>('loading');
  const [filters, setFilters]             = useState<PaperFilters>(DEFAULT_FILTERS);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  useEffect(() => {
    setLoadState('loading');
    fetchPapers(filters)
      .then((data) => {
        setPapers(data);
        setLoadState(data.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setLoadState('error'));
  }, [filters]);

  function setFilter<K extends keyof PaperFilters>(key: K, value: PaperFilters[K]) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'curriculum' ? { grade: '' } : {}),
    }));
  }

  const gradeOptions =
    filters.curriculum === 'CBE' ? CBE_GRADES :
    filters.curriculum === '844' ? FORM_GRADES :
    [...CBE_GRADES, ...FORM_GRADES];

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className={`flex min-h-screen flex-col ${PAGE_BG}`}>
      {/* Header */}
      <header className="bg-[#1A56DB] text-white py-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <img
              src={revisionhub}
              alt="RevisionHub"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-white/70">
            Pay per download · No account needed
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold">
          <span className="text-white">RevisionHub</span>{' '}
          <span className="text-[#FAC775]">Robert</span>
        </h1>
        <p className="text-white/70 text-sm mt-3">
          Smarter Revision. Better Results.
        </p>
      </header>

      {/* Filters */}
      <div className="w-full px-4 pt-6 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <FilterSelect
            label="Curriculum"
            allLabel="All Curricula"
            Icon={BookOpen}
            value={filters.curriculum}
            onChange={(v: string) => setFilter('curriculum', v as Curriculum | '')}
            options={CURRICULA}
          />
          <FilterSelect
            label="Grade"
            allLabel="All Grades"
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
            onChange={(v: string) => setFilter('exam_type', v as ExamType | '')}
            options={toOptions(EXAM_TYPES)}
          />
          <FilterSelect
            label="Term"
            allLabel="All Terms"
            Icon={FileText}
            value={filters.term}
            onChange={(v: string) => setFilter('term', v as Term | '')}
            options={TERMS.map((t) => ({ value: t, label: `Term ${t}` }))}
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
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-10">
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {papers.map((paper) => (
                <PaperCardV2 key={paper.id} paper={paper} onSelect={setSelectedPaper} />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedPaper && (
        <BuyModal paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      )}
    </div>
  );
}