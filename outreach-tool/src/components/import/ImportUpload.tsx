import { Upload, FileJson, FileText } from 'lucide-react';
import { type LeadSource } from '@/lib/types';

interface Mapping {
  csvColumn: string | null;
  leadField: string | null;
}

interface ImportUploadProps {
  file: File | null;
  fileType: 'csv' | 'json';
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string;
}

interface CsvColumnMapperProps {
  source: LeadSource;
  setSource: (v: LeadSource) => void;
  category: string;
  setCategory: (v: string) => void;
  headers: string[];
  mappings: Mapping[];
  previewRows: Record<string, string>[];
  updateMapping: (index: number, field: string | null) => void;
  LEAD_FIELDS: { key: string; label: string; required: boolean }[];
}

export type { Mapping, CsvColumnMapperProps };

export default function ImportUpload({ file, fileType, handleFile, error }: ImportUploadProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">1. Upload File</h2>
      {!file ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#3f3f46] rounded-xl p-8 cursor-pointer hover:border-blue-500/50 transition">
          <Upload className="w-8 h-8 text-gray-500 mb-3" />
          <p className="text-sm text-gray-400 mb-1">
            <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-600">CSV or JSON file, max 5MB</p>
          <input type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
        </label>
      ) : (
        <div className="flex items-center justify-between bg-[#27272a] rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            {fileType === 'json' ? (
              <FileJson className="w-5 h-5 text-blue-400" />
            ) : (
              <FileText className="w-5 h-5 text-green-400" />
            )}
            <div>
              <p className="text-sm text-white font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              fileType === 'json'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-green-500/20 text-green-300'
            }`}>
              {fileType.toUpperCase()}
            </span>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
              <span className="text-xs text-blue-400 hover:text-blue-300">Change</span>
            </label>
          </div>
        </div>
      )}

      {error && !file && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function JsonPreviewNotice() {
  return (
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
      <p className="text-sm text-blue-200">
        <strong>JSON file detected.</strong> This will auto-map google-maps-scraper format
        and import owner enrichment data (LinkedIn profiles, Apollo emails) into separate tables.
      </p>
    </div>
  );
}

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'manual', label: 'Manual' },
  { value: 'apify_n8n', label: 'Apify/n8n' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

export function CsvColumnMapper({
  source, setSource, category, setCategory, headers, mappings, previewRows, updateMapping, LEAD_FIELDS,
}: CsvColumnMapperProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">2. Map Columns</h2>

      {/* Source selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
          Default Source for imported leads
        </label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as LeadSource)}
          className="w-full sm:w-[200px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
          Category (e.g. restaurant, construction)
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Enter category name"
          className="w-full sm:w-[200px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Optional: groups these leads together for filtering</p>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <CSVPreviewTable headers={headers} rows={previewRows.slice(0, 3)} />
      )}

      <p className="text-xs text-gray-500 mb-3">Map each CSV column to a lead field. Leave unmapped to skip.</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {headers.map((col, index) => {
          const mapping = mappings[index] || { csvColumn: col, leadField: null };
          return (
            <div
              key={index}
              className="flex items-center gap-3 bg-[#27272a] rounded-lg px-3 py-2 border border-[#3f3f46]"
            >
              <span className="text-xs text-gray-400 min-w-[120px] truncate flex-1" title={col}>
                {col}
              </span>
              <select
                value={mapping.leadField ?? ''}
                onChange={(e) => updateMapping(index, e.target.value || null)}
                className="bg-[#1a1a1a] border border-[#3f3f46] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              >
                <option value="" className="bg-[#1a1a1a]">— Skip —</option>
                {LEAD_FIELDS.map((field) => (
                  <option key={field.key} value={field.key} className="bg-[#1a1a1a]">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CSVPreviewTable({ headers, rows }: { headers: string[]; rows: Record<string, string>[] }) {
  return (
    <div className="mb-4">
      <p className="text-xs text-gray-500 mb-2">Preview (first {rows.length} rows):</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#3f3f46]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider whitespace-nowrap"
                >
                  {h.length > 20 ? h.slice(0, 20) + '...' : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#27272a]">
                {Object.values(row).map((val, j) => (
                  <td key={j} className="px-3 py-2 text-gray-300 max-w-[150px] truncate">
                    {val || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
