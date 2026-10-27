'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTelnyxCall, UseTelnyxCallReturn } from '@/hooks/use-telnyx-call';

const CallContext = createContext<UseTelnyxCallReturn | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const call = useTelnyxCall();
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
}

export function useCall(): UseTelnyxCallReturn {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return ctx;
}
