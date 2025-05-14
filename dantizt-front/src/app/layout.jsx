import { Inter } from 'next/font/google';
import RootLayoutClient from '@/components/RootLayoutClient';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DantiZT',
  description: 'DantiZT - Dental Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
      </body>
    </html>
  );
}
