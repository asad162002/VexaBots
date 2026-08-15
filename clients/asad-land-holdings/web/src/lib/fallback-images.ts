export function propertyFallbackImage(id: string): string {
  const useFirst = id.charCodeAt(0) % 2 === 0
  return useFirst ? '/fallbacks/property-fallback1.png' : '/fallbacks/property-fallback2.png'
}

export function projectFallbackImage(id: string): string {
  const useFirst = id.charCodeAt(0) % 2 === 0
  return useFirst ? '/fallbacks/project-fallback1.png' : '/fallbacks/project-fallback2.png'
}
