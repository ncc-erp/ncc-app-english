import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TITLE = 'Mezon IELTS – Luyện IELTS Speaking cùng giám khảo AI';
const DESCRIPTION =
  'Thi thử IELTS Speaking đủ 3 Part, ghi âm ngay trên trình duyệt, nhận Band score 1.0–9.0 và nhận xét chi tiết miễn phí.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Mezon IELTS' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    siteName: 'Mezon IELTS',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/opengraph-image'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
