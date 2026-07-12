'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartCount, onCartChange } from '@/lib/cart';

// 상단 헤더 — 로그인 상태(본인 마스킹 프로필)와 장바구니 수량을 표시.
// 세션 여부는 GET /api/me 200/401 로 판별한다(토큰은 httpOnly 쿠키라 JS 접근 불가).
export default function Nav() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCount(cartCount());
    return onCartChange(() => setCount(cartCount()));
  }, []);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d ? { name: d.name, role: d.role } : null))
      .catch(() => setMe(null))
      .finally(() => setReady(true));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          🛍️ 스마트<b>스토어</b>
        </Link>
        <div className="nav-spacer" />
        <Link href="/cart" className="nav-link">
          장바구니
          {count > 0 && <span className="cart-badge">{count}</span>}
        </Link>
        {ready && me && (
          <>
            <Link href="/mypage" className="nav-link">
              {me.name}님{me.role !== 'CUSTOMER' ? ` (${me.role})` : ''}
            </Link>
            <a className="nav-link" style={{ cursor: 'pointer' }} onClick={logout}>
              로그아웃
            </a>
          </>
        )}
        {ready && !me && (
          <>
            <Link href="/login" className="nav-link">
              로그인
            </Link>
            <Link href="/signup" className="nav-link">
              회원가입
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
