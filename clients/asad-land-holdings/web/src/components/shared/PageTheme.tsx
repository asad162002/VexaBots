'use client'

import { createContext, useContext } from 'react'

type Theme = 'dark' | 'light'

const PageThemeContext = createContext<Theme>('dark')

export function PageTheme({ value, children }: { value: Theme; children: React.ReactNode }) {
  return <PageThemeContext.Provider value={value}>{children}</PageThemeContext.Provider>
}

export function usePageTheme(): Theme {
  return useContext(PageThemeContext)
}