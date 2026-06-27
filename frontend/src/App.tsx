import { useEffect, useState } from 'react';
import type { Paper, PaperFilters, Curriculum, ExamType, Term } from './types';
import { fetchPapers } from './api';
import PaperCard from './components/PaperCard';
import BuyModal from './components/BuyModal';

const CBC_GRADES  = ['PP1', 'PP2', 'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10'];
const FORM_GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
const EXAM_TYPES: ExamType[]  = ['Opener', 'Mid Term', 'End Term'];
const TERMS: Term[]           = ['1', '2', '3'];
const CURRENT_YEAR            = new Date().getFullYear();
const YEARS                   = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(String);

const DEFAULT_FILTERS: PaperFilters = {
  curriculum: '',
  grade: '',
  exam_type: '',
  term: '',
  year: '',
};

type LoadState = 'loading' | 'ready' | 'error' | 'empty';

export default function App() {
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
    filters.curriculum === 'CBC'  ? CBC_GRADES  :
    filters.curriculum === '844'  ? FORM_GRADES :
    [...CBC_GRADES, ...FORM_GRADES];

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="bg-[#1A56DB] text-white py-10 px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-white/70 mb-2">
          Pay per download · No account needed
        </p>
        <h1 className="font-display text-3xl font-bold">
          Exam Papers Kenya
        </h1>
        <p className="text-white/70 text-sm mt-2">CBC &amp; 8-4-4 · Past Papers with Answers</p>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={filters.curriculum}
            onChange={(e) => setFilter('curriculum', e.target.value as Curriculum | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Curricula</option>
            <option value="CBC">CBC</option>
            <option value="844">8-4-4</option>
          </select>

          <select
            value={filters.grade}
            onChange={(e) => setFilter('grade', e.target.value)}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Grades</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={filters.exam_type}
            onChange={(e) => setFilter('exam_type', e.target.value as ExamType | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Exam Types</option>
            {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filters.term}
            onChange={(e) => setFilter('term', e.target.value as Term | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Terms</option>
            {TERMS.map((t) => <option key={t} value={t}>Term {t}</option>)}
          </select>

          <select
            value={filters.year}
            onChange={(e) => setFilter('year', e.target.value)}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Clear filters */}
        {Object.values(filters).some(Boolean) && (
          <div className="max-w-5xl mx-auto mt-2 text-right">
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Paper grid */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {loadState === 'loading' && (
          <p className="text-center text-gray-400">Loading papers…</p>
        )}
        {loadState === 'error' && (
          <p className="text-center text-stamp">
            Could not load papers. Refresh to try again.
          </p>
        )}
        {loadState === 'empty' && (
          <p className="text-center text-gray-400">
            No papers found for the selected filters.
          </p>
        )}
        {loadState === 'ready' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} onSelect={setSelectedPaper} />
            ))}
          </div>
        )}
      </main>

      {selectedPaper && (
        <BuyModal paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      )}
    </div>
  );
}