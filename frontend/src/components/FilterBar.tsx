import { BarChart3, BookOpen, Calendar, ChevronDown, FileText, List } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export interface FilterValues {
  curriculum: string;
  grade: string;
  examType: string;
  term: string;
  year: string;
}

export const EMPTY_FILTERS: FilterValues = {
  curriculum: '',
  grade: '',
  examType: '',
  term: '',
  year: '',
};

export interface FilterOptions {
  curricula: string[];
  grades: string[];
  examTypes: string[];
  terms: string[];
  years: string[];
}

/** The paper fields the filters read. Every field is optional, so any Paper type fits. */
export interface FilterablePaper {
  curriculum?: string | null;
  grade?: string | null;
  exam_type?: string | null;
  term?: string | number | null;
  year?: string | number | null;
}

// ---------------------------------------------------------------------
// Helpers: build the dropdown options from THIS store's papers only
// ---------------------------------------------------------------------
const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true });
const uniq = (values: unknown[]): string[] =>
  Array.from(new Set(values.map(clean).filter(Boolean)));
const termLabel = (v: string) => (/^\d+$/.test(v) ? `Term ${v}` : v);

export function buildFilterOptions(papers: FilterablePaper[]): FilterOptions {
  return {
    curricula: uniq(papers.map((p) => p.curriculum)).sort(naturalCompare),
    grades: uniq(papers.map((p) => p.grade)).sort(naturalCompare),
    examTypes: uniq(papers.map((p) => p.exam_type)).sort(naturalCompare),
    terms: uniq(papers.map((p) => p.term)).sort(naturalCompare),
    years: uniq(papers.map((p) => p.year)).sort((a, b) => Number(b) - Number(a)),
  };
}

export function filterPapers<T extends FilterablePaper>(papers: T[], f: FilterValues): T[] {
  return papers.filter(
    (p) =>
      (!f.curriculum || clean(p.curriculum) === f.curriculum) &&
      (!f.grade || clean(p.grade) === f.grade) &&
      (!f.examType || clean(p.exam_type) === f.examType) &&
      (!f.term || clean(p.term) === f.term) &&
      (!f.year || clean(p.year) === f.year)
  );
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------
interface FieldConfig {
  key: keyof FilterValues;
  label: string;
  allLabel: string;
  Icon: LucideIcon;
  items: { value: string; label: string }[];
}

interface Props {
  values: FilterValues;
  options: FilterOptions;
  onChange: (key: keyof FilterValues, value: string) => void;
  className?: string;
}

const same = (list: string[]) => list.map((v) => ({ value: v, label: v }));

/**
 * Native <select> elements (accessible, and the best experience on phones) with
 * an icon on the left and a chevron on the right. A dropdown with no options is
 * hidden, so a store with no grades set does not show an empty "All Grades".
 */
export default function FilterBar({ values, options, onChange, className = '' }: Props) {
  const fields: FieldConfig[] = [
    { key: 'curriculum', label: 'Curriculum', allLabel: 'All Curricula', Icon: BookOpen, items: same(options.curricula) },
    { key: 'grade', label: 'Grade', allLabel: 'All Grades', Icon: BarChart3, items: same(options.grades) },
    { key: 'examType', label: 'Paper type', allLabel: 'All Types', Icon: List, items: same(options.examTypes) },
    {
      key: 'term',
      label: 'Term',
      allLabel: 'All Terms',
      Icon: FileText,
      items: options.terms.map((v) => ({ value: v, label: termLabel(v) })),
    },
    { key: 'year', label: 'Year', allLabel: 'All Years', Icon: Calendar, items: same(options.years) },
  ];

  const visible = fields.filter((f) => f.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {visible.map(({ key, label, allLabel, Icon, items }) => {
        const active = values[key] !== '';
        return (
          <label key={key} className="relative block min-w-[170px] flex-1">
            <span className="sr-only">{label}</span>
            <Icon
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1A56DB]"
              aria-hidden="true"
            />
            <select
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className={`w-full cursor-pointer appearance-none truncate rounded-xl border border-white bg-white py-3 pl-11 pr-10 text-sm font-semibold text-[#0B2A7A] shadow-[0_2px_8px_rgba(11,42,122,0.08)] transition focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/40 ${
                active ? 'ring-2 ring-[#1A56DB]/50' : ''
              }`}
            >
              <option value="">{allLabel}</option>
              {items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0B2A7A]"
              aria-hidden="true"
            />
          </label>
        );
      })}
    </div>
  );
}