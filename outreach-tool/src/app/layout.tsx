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
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%235e6ad2'/><path d='M50 20 L50 80 M20 50 L80 50' stroke='white' stroke-width='12' stroke-linecap='round'/></svg>"
        />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;510;590&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "#08090a", color: "#f7f8f8" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
