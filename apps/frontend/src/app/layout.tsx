import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'GLD System v.2 — Gas Leak Detection Monitoring',
  description: 'Gas Leak Detection Monitoring System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} min-h-screen font-sans bg-bg-dark text-foreground`}>
        {children}
      </body>
    </html>
  );
}
