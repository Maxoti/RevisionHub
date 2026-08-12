import { useEffect, useState } from 'react';
import type { Paper, PaperFilters, Curriculum, ExamType, Term } from './types';
import { fetchPapers } from './api';
import PaperCard from './components/PaperCard';
import BuyModal from './components/BuyModal';
const SITE_VARIANT = import.meta.env.VITE_SITE_VARIANT || 'default';

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1A56DB] text-white py-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="relative w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1A56DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-600 border-2 border-[#1A56DB] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-white/70">
            Pay per download · No account needed
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold">
          <span className="text-white">Exam</span>{' '}
          <span className="text-[#FAC775]">Papers</span>{' '}
          <span className="inline-block border-2 border-white rounded-full px-4 py-0.5 text-white">
            Kenya
          </span>
        </h1>
        <p className="text-white/70 text-sm mt-3">CBC &amp; 8-4-4 · Past Papers with Answers</p>
      </header>

     {/* WhatsApp community banner — Austine only */}
      {SITE_VARIANT === 'austine' && (
        <div className="bg-green-50 border-b border-green-100 px-4 py-3 text-center relative">
          <details className="inline-block text-left">
            <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              </svg>
              Join our WhatsApp community
            </summary>
            <div className="mt-2 bg-white border border-green-200 rounded-md shadow-md p-2 flex flex-col gap-1 absolute z-10">
              <a href="https://chat.whatsapp.com/LcHkl5h5JCZ82F8sjESRxR?s=cl&p=a&ilr=1" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 rounded">Grade 10 Parents Group</a>
              <a href="https://chat.whatsapp.com/Jiil0ZnMDkWHArzt4dT9S6?s=cl&p=a&ilr=1" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 rounded">Group 2</a>
              <a href="https://chat.whatsapp.com/CWF0MRqvbE35ANUDyMdOTr?s=cl&p=a&ilr=1" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 rounded">Weekly Exams Group</a>
              <a href="https://chat.whatsapp.com/Cjc6LFlY1EZHn88xkMRJa1?s=cl&p=a&ilr=1" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 rounded">Group 4</a>
            </div>
          </details>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={filters.curriculum}
            onChange={(e) => setFilter('curriculum', e.target.value as Curriculum | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Curricula</option>
            <option value="CBC">CBC</option>
            <option value="844">8-4-4</option>
          </select>

          <select
            value={filters.grade}
            onChange={(e) => setFilter('grade', e.target.value)}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Grades</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={filters.exam_type}
            onChange={(e) => setFilter('exam_type', e.target.value as ExamType | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Exam Types</option>
            {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filters.term}
            onChange={(e) => setFilter('term', e.target.value as Term | '')}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Terms</option>
            {TERMS.map((t) => <option key={t} value={t}>Term {t}</option>)}
          </select>

          <select
            value={filters.year}
            onChange={(e) => setFilter('year', e.target.value)}
            className="border border-gray-200 bg-white rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {Object.values(filters).some(Boolean) && (
          <div className="mt-2 text-right">
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Paper grid — full width, no max-width constraint */}
      <main className="px-4 py-6 flex-1">
        {loadState === 'loading' && (
          <p className="text-center text-gray-400">Loading papers…</p>
        )}
        {loadState === 'error' && (
          <p className="text-center text-red-500">
            Could not load papers. Refresh to try again.
          </p>
        )}
        {loadState === 'empty' && (
          <p className="text-center text-gray-400">
            No papers found for the selected filters.
          </p>
        )}
        {loadState === 'ready' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} onSelect={setSelectedPaper} />
            ))}
          </div>
        )}
      </main>

   {/* Marketing footer — Austine only */}
      {SITE_VARIANT === 'austine' && (
        <footer className="bg-gray-900 text-white px-6 py-8 mt-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-gray-400 mb-4">Follow us & explore more</p>
            <div className="flex justify-center gap-6 mb-4">
              
              <a
                href="https://www.facebook.com/share/191QLVDRhY/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.523 1.492-3.917 3.777-3.917 1.094 0 2.238.197 2.238.197v2.475h-1.26c-1.242 0-1.63.775-1.63 1.57v1.89h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94z"/>
                </svg>
                Facebook
              </a>
            </div>
            <p className="text-xs text-gray-500">
              Also visit:{' '}
              <a
              
                href="https://mwalimuaustineapp.co.ke"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-300"
              >
                Mwalimu Austine App
              </a>
            </p>
          </div>
        </footer>
      )}

      {selectedPaper && (
        <BuyModal paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      )}
    </div>
  );
}