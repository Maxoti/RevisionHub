import { ShoppingCart } from 'lucide-react';
import type { Paper } from '../types';

interface Props {
  paper: Paper;
  onSelect: (paper: Paper) => void;
}

function FileIcon({ label, color }: { label: string; color: string }) {
  return (
    <svg viewBox="0 0 40 48" className="h-12 w-10 shrink-0" aria-hidden="true" focusable="false">
      <path
        d="M6 1h19l13 13v29a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V5a4 4 0 0 1 4-4z"
        fill={color}
      />
      <path d="M25 1v9a4 4 0 0 0 4 4h9z" fill="#FFFFFF" fillOpacity="0.85" />
      <text
        x="20"
        y="38"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

// White-blue card for single-tenant sites that opt in (currently Robert).
// The original PaperCard.tsx is left untouched for all other clients.
export default function PaperCardV2({ paper, onSelect }: Props) {
  const curriculumLabel = String(paper.curriculum) === '844' ? '8-4-4' : paper.curriculum;
  const meta = [curriculumLabel, paper.year].filter(Boolean).join(' · ');
  const termLabel = /^\d+$/.test(String(paper.term)) ? `Term ${paper.term}` : paper.term;
  const details = [paper.exam_type, termLabel, paper.subject].filter(Boolean).join(' • ');

  return (
    <article className="relative rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(11,42,122,0.08)] ring-1 ring-[#0B2A7A]/5 transition-shadow hover:shadow-[0_8px_24px_rgba(11,42,122,0.16)]">
      <span className="absolute right-4 top-4 rounded-full bg-[#19C45F] px-3 py-1 text-sm font-bold text-white shadow-sm">
        KES {paper.price}
      </span>

      <div className="flex min-h-[28px] items-center gap-2 pr-24">
        {paper.is_bundle && (
          <span className="rounded-full bg-[#1A56DB] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            FULL SET
          </span>
        )}
        {meta && <p className="text-sm font-semibold text-[#0B2A7A]">{meta}</p>}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <FileIcon
          label={paper.is_bundle ? 'ZIP' : 'PDF'}
          color={paper.is_bundle ? '#F59E0B' : '#E5322D'}
        />
        <div className="min-w-0">
          <h3 className="line-clamp-3 text-base font-bold leading-snug text-[#0B2A7A]">
            {paper.title}
          </h3>
          {details && (
            <p className="mt-1.5 text-xs leading-relaxed text-[#0B2A7A]/70">{details}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(paper)}
        aria-label={`${paper.is_bundle ? 'Buy full set' : 'Buy and download'}: ${paper.title}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1A56DB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1543ad] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A56DB]/50 focus-visible:ring-offset-2"
      >
        <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
        {paper.is_bundle ? 'Buy Full Set' : 'Buy & Download'}
      </button>
    </article>
  );
}