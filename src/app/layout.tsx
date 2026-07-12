import type { ReactNode } from 'react';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: '스마트스토어 클론 — PII 보호형 쇼핑몰',
  description: '실무형 PIPA 개인정보 처리 MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Nav />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
