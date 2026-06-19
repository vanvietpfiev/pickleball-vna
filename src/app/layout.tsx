import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/components/AuthProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Pickleball VNA - Ban Kỹ Thuật',
  description: 'Quản lý kết quả và xếp hạng Pickleball đội Ban Kỹ Thuật Vietnam Airlines',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen overflow-x-hidden" style={{ background: '#f0f4ff' }}>
        <AuthProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-4 md:py-8 pb-24 md:pb-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
