export function InvertedSection({
  theme,
  className,
  children,
}: {
  theme: 'dark' | 'light'
  className?: string
  children: React.ReactNode
}) {
  const bg = theme === 'dark' ? 'bg-cocoa text-cream' : 'bg-cream text-cocoa'
  return <section className={bg + ' ' + (className ?? '')}>{children}</section>
}
