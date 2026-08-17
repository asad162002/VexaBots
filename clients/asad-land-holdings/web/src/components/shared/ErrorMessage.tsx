'use client'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
  theme: 'dark' | 'light'
}

export default function ErrorMessage({ message, onRetry, theme }: ErrorMessageProps) {
  const textColor = theme === 'dark' ? 'text-cream' : 'text-cocoa'

  return (
    <div role="alert" className={`flex flex-col items-center gap-3 text-center font-body ${textColor}`}>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-display bg-brick-clay px-4 py-2 text-cream transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      )}
    </div>
  )
}
