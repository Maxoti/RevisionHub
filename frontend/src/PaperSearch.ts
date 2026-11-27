import { useEffect, useState } from 'react';
import type { Paper } from './types';

export function usePaperSearch(papers: Paper[], pageSize = 16) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const matches = papers.filter((p) =>
    [p.title, p.subject, p.term, p.exam_type]
      .some((v) => String(v ?? '').toLowerCase().includes(q))
  );

  // Go back to page 1 when the results change
  const resultKey = matches.map((p) => p.id).join(',');
  useEffect(() => setPage(1), [resultKey]);

  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, totalPages);

  return {
    text,
    setText: (value: string) => {
      setText(value);
      if (!value) setQuery('');
    },
    search: () => setQuery(text),
    page: current,
    setPage,
    totalPages,
    total: matches.length,
    visible: matches.slice((current - 1) * pageSize, current * pageSize),
  };
}