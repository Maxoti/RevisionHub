interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );
  const base = 'h-10 min-w-10 rounded-xl border px-3 text-sm font-bold disabled:opacity-40';
  const idle = `${base} border-[#1A56DB]/20 bg-white text-[#0B2A7A]`;

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      <button type="button" className={idle} disabled={page === 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      {numbers.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numbers[i - 1] > 1 && <span>…</span>}
          <button
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={n === page ? `${base} border-[#1A56DB] bg-[#1A56DB] text-white` : idle}
          >
            {n}
          </button>
        </span>
      ))}
      <button type="button" className={idle} disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}