import type { ReactNode } from 'react';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500', '600', '700'] });

export const metadata = {
  title: 'GLD System v.2 — Gas Leak Detection Monitoring',
  description: 'Gas Leak Detection Monitoring System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} min-h-screen font-sans bg-bg-dark text-foreground`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
