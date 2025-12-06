import type { Metadata } from 'next'
import './globals.css'
import { ClientProviders } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Peer Feedback Platform',
  description: 'A safe and anonymous platform for giving and receiving constructive feedback',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
