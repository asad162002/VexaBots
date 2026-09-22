import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vexabots Outreach Tool',
  description: 'Lead management and outreach tracking for Vexabots',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%233b82f6'/><path d='M50 20 L50 80 M20 50 L80 50' stroke='white' stroke-width='12' stroke-linecap='round'/></svg>"
        />
      </head>
      <body className="min-h-screen bg-[#0f0f0f] text-white antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
