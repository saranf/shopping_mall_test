import { NextRequest, NextResponse } from 'next/server';

// 전역 보안 헤더 + CSP(요청별 nonce).
// 세션 검증은 각 라우트에서 수행하고, 여기서는 방어적 헤더만 일괄 부여한다.
//
// CSP: Next.js는 인라인 하이드레이션 스크립트(RSC 페이로드)를 주입하므로
// script-src 'self' 만으로는 클라이언트 컴포넌트가 동작하지 않는다.
// 요청마다 nonce를 생성해 CSP 헤더에 넣으면 Next가 자체 스크립트에 자동 부여한다.
// 'strict-dynamic'으로 nonce가 신뢰한 로더가 불러오는 청크까지 신뢰를 전파한다.
// (공식 Next.js nonce CSP 패턴)
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isProd = process.env.NODE_ENV === 'production';

  // 개발 모드는 React Fast Refresh가 eval을 사용하므로 'unsafe-eval' 허용
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');

  // nonce를 요청 헤더로 넘겨 Next가 스크립트에 부여하도록 한다
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (isProd) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export const config = {
  // 정적 자산은 제외하되, 모든 페이지/라우트에 nonce CSP 적용
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
