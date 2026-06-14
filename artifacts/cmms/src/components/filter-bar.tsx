import { Input, Select } from "@/components/ui";
import { X, Search } from "lucide-react";

export interface FilterState {
  date: string;
  shift: string;
  search?: string;
  status?: string;
}

interface StatusOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  showShift?: boolean;
  showDate?: boolean;
  showSearch?: boolean;
  statusOptions?: StatusOption[];
  label?: string;
}

export function FilterBar({
  filters,
  onChange,
  showShift = true,
  showDate = true,
  showSearch = false,
  statusOptions,
  label = "Filter:",
}: FilterBarProps) {
  const hasActive = filters.date || filters.shift || filters.search || filters.status;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>

      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={filters.search ?? ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="h-8 text-xs pl-6 w-40"
          />
        </div>
      )}

      {showDate && (
        <Input
          type="date"
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
          className="h-8 text-xs w-36"
        />
      )}

      {showShift && (
        <Select
          value={filters.shift}
          onChange={(e) => onChange({ ...filters, shift: e.target.value })}
          className="h-8 text-xs w-36"
        >
          <option value="">All Shifts</option>
          <option value="day">Day Shift</option>
          <option value="night">Night Shift</option>
        </Select>
      )}

      {statusOptions && statusOptions.length > 0 && (
        <Select
          value={filters.status ?? ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="h-8 text-xs w-36"
        >
          <option value="">All Status</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )}

      {hasActive && (
        <button
          onClick={() => onChange({ date: "", shift: "", search: "", status: "" })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

export function getShiftFromDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const h = new Date(dateStr).getHours();
  if (h >= 6 && h < 18) return "day";
  return "night";
}

export function matchesDateFilter(dateStr: string | null | undefined, filterDate: string): boolean {
  if (!filterDate) return true;
  if (!dateStr) return false;
  return new Date(dateStr).toISOString().slice(0, 10) === filterDate;
}

export function matchesShiftFilter(dateStr: string | null | undefined, filterShift: string, shiftField?: string): boolean {
  if (!filterShift) return true;
  if (shiftField) return shiftField === filterShift;
  return getShiftFromDate(dateStr) === filterShift;
}

export function matchesSearch(fields: (string | null | undefined)[], search: string | undefined): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}
