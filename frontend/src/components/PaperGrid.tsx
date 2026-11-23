import { useMemo, useState } from 'react';
import type { Paper } from '../types';
import PaperCard from './PaperCard.saas';
import FilterBar, { EMPTY_FILTERS, buildFilterOptions, filterPapers } from './FilterBar';
import type { FilterValues } from './FilterBar';

interface Props {
  papers: Paper[];
  onSelect: (paper: Paper) => void;
  loading?: boolean;
}

/**
 * The area the paper cards sit on: a soft white-blue background, the filter
 * dropdowns, and the grid. There is deliberately no banner or store name in here;
 * the page header (name taken from the store slug) belongs to the page.
 *
 * Place it OUTSIDE any max-width wrapper, so the blue background runs edge to edge.
 */
export default function PaperGrid({ papers, onSelect, loading = false }: Props) {
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const options = useMemo(() => buildFilterOptions(papers), [papers]);
  const visible = useMemo(() => filterPapers(papers, filters), [papers, filters]);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section className="min-h-[60vh] w-full bg-gradient-to-b from-[#E6EFFF] via-[#EEF4FF] to-[#F7FAFF] py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <FilterBar
          values={filters}
          options={options}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        />

        {!loading && (
          <p className="mb-4 mt-5 text-sm font-medium text-[#0B2A7A]/70" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'paper' : 'papers'}
          </p>
        )}

        {loading ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
            <p className="font-semibold text-[#0B2A7A]">No papers match these filters.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-4 rounded-full bg-[#1A56DB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1543ad]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((paper) => (
              <PaperCard key={paper.id} paper={paper} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}