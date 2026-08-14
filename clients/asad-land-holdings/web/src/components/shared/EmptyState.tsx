import Link from 'next/link'

interface EmptyStateProps {
  message: string
  actionLabel?: string
  actionHref?: string
  theme: 'dark' | 'light'
}

export default function EmptyState({ message, actionLabel, actionHref, theme }: EmptyStateProps) {
  const textColor = theme === 'dark' ? 'text-cream' : 'text-cocoa'
  const showAction = actionLabel && actionHref

  return (
    <div className={`flex flex-col items-center gap-3 text-center font-body ${textColor}`}>
      <p>{message}</p>
      {showAction && (
        <Link
          href={actionHref}
          className="font-display underline decoration-brick-clay underline-offset-4"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
