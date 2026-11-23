import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
  Icon: LucideIcon;
  options: FilterOption[];
}

/**
 * One filter dropdown: white rounded field, blue icon on the left, chevron on the
 * right. It is a native <select>, so it stays accessible and opens the phone's own
 * picker on mobile. It holds no state: the page owns the value and the options.
 */
export default function FilterSelect({ label, allLabel, value, onChange, Icon, options }: Props) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1A56DB] sm:left-3.5"
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full cursor-pointer appearance-none truncate rounded-xl border border-white bg-white py-3 pl-10 pr-8 text-sm font-semibold text-[#0B2A7A] shadow-[0_2px_8px_rgba(11,42,122,0.08)] transition focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/40 sm:pl-11 sm:pr-10 ${
          value ? 'ring-2 ring-[#1A56DB]/50' : ''
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0B2A7A] sm:right-3.5"
        aria-hidden="true"
      />
    </label>
  );
}