import type { Paper } from '../types';

interface Props {
  paper: Paper;
  onSelect: (paper: Paper) => void;
}

// SaaS-only copy of PaperCard. The single-tenant PaperCard.tsx is left untouched.
export default function PaperCard({ paper, onSelect }: Props) {
  const meta = [paper.curriculum, paper.year].join(' · ');
  const termLabel = /^\d+$/.test(String(paper.term)) ? `Term ${paper.term}` : paper.term;

  return (
    <div className="group relative border rounded-sm shadow-sm hover:shadow-md transition-shadow pt-5 bg-white border-gray-200">

      {/* Full Set badge */}
      {paper.is_bundle && (
        <div className="absolute top-3 left-3 bg-[#1A56DB] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-wide">
          FULL SET
        </div>
      )}

      {/* Price stamp */}
      <div className="absolute top-3 right-3 bg-stamp text-white font-mono text-xs font-bold px-2 py-1 rounded-sm shadow-sm">
        KES {paper.price}
      </div>

      <div className="p-5 pt-8">
        {/* Curriculum + year */}
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">
          {meta}
        </p>

        {/* Title */}
        <h3 className="font-display text-base font-semibold text-chalkboard leading-snug mb-1">
          {paper.title}
        </h3>

        {/* Exam type + term + subject */}
        <p className="text-xs text-gray-400 mb-4">
          {paper.exam_type} · {termLabel}
          {paper.subject && <> · {paper.subject}</>}
        </p>

        <div className="rule-underline w-full mb-4" />

        <button
          onClick={() => onSelect(paper)}
          className="inline-flex w-full items-center justify-center gap-2 font-semibold text-sm py-3 rounded-full transition-all shadow-md hover:shadow-lg hover:scale-[1.02] bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          {paper.is_bundle ? 'Buy Full Set' : 'Buy & Download'}
        </button>
      </div>
    </div>
  );
}