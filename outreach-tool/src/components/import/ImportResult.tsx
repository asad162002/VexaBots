import { Upload, CheckCircle } from 'lucide-react';
import { type LeadSource } from '@/lib/types';

interface ImportResultProps {
  success: { total: number; inserted: number; skipped: number; enriched?: number } | null;
  skippedDetails?: string[];
  onImport: () => void;
  onReset: () => void;
  importing: boolean;
  file: File | null;
}

export default function ImportResult({ success, skippedDetails, onImport, onReset, importing, file }: ImportResultProps) {
  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
        </div>
        <p className="text-white font-medium">Import complete</p>
        <p className="text-sm text-gray-400 mt-1">
          {success.total} rows processed — {success.inserted} added, {success.skipped} skipped
          {success.enriched ? ` (${success.enriched} enriched leads added)` : ''}
        </p>
        {skippedDetails && skippedDetails.length > 0 && (
          <details className="mt-3 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer mb-1">View skipped rows</summary>
            <ul className="text-xs text-gray-500 space-y-0.5 max-h-32 overflow-y-auto">
              {skippedDetails.map((detail, i) => (
                <li key={i} className="py-0.5">{detail}</li>
              ))}
            </ul>
          </details>
        )}
        <button
          onClick={() => window.location.assign('/dashboard')}
          className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
        >
          View leads
        </button>
      </div>
    );
  }

  if (!file) return null;

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onImport}
        disabled={importing}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition disabled:cursor-not-allowed flex items-center gap-2"
      >
        {importing ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Importing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Import {file.name}
          </>
        )}
      </button>
      <button
        onClick={onReset}
        className="text-gray-400 hover:text-white text-sm transition"
      >
        Start over
      </button>
    </div>
  );
}
