import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export default function SearchBar({ value, onChange, onSearch }: Props) {
  return (
    <form
      className="mb-4 flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by title, subject or term..."
        aria-label="Search papers"
        className="min-w-0 flex-1 rounded-full border border-[#1A56DB]/20 bg-white px-5 py-3 text-sm text-[#0B2A7A] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30"
      />
      <button type="submit" className="flex items-center gap-2 rounded-full bg-[#1A56DB] px-5 py-3 font-semibold text-white">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );
}