import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cocoa px-6 text-center text-cream">
      <h1 className="font-display text-4xl sm:text-5xl">This page doesn&apos;t exist.</h1>
      <p className="font-body mt-4 max-w-md text-cream/70">
        The page you&apos;re looking for may have moved or been removed.
      </p>
      <Link
        href="/"
        className="font-display mt-8 bg-brick-clay px-6 py-3 text-cream transition-opacity hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  )
}
