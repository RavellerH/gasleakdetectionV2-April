import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'GLD System v.2 — Gas Leak Detection Monitoring',
  description: 'Gas Leak Detection Monitoring System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans bg-bg-dark text-foreground">
        {children}
      </body>
    </html>
  );
}
