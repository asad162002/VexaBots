import Link from "next/link";

export function Pagination({
  totalPages,
  currentPage,
  baseUrl,
  queryString,
}: {
  totalPages: number;
  currentPage: number;
  baseUrl: string;
  queryString: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={`${baseUrl}?page=${p}${queryString}`}
          className={`px-3 py-1 rounded text-sm ${
            p === currentPage
              ? "bg-brown text-cream"
              : "bg-white/40 text-brown-light border border-brown-light/30"
          }`}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}