interface LoadingSpinnerProps {
  label?: string
}

export default function LoadingSpinner({ label = 'Loading' }: LoadingSpinnerProps) {
  return (
    <div role="status" className="flex items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-brick-clay border-t-transparent"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
