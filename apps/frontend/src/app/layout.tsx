import type { ReactNode } from 'react';
import { DM_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500', '600', '700'] });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400', '500', '700'] });

export const metadata = {
  title: 'GLD System v.2 — Gas Leak Detection Monitoring',
  description: 'Gas Leak Detection Monitoring System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${geistMono.variable} min-h-screen font-sans bg-bg-dark text-foreground`}>
        {children}
      </body>
    </html>
  );
}
