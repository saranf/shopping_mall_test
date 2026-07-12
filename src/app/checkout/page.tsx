'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, cartTotal, clearCart, onCartChange, type CartLine } from '@/lib/cart';

// 주문서 — 배송지 개인정보는 서버(POST /api/orders)에서 암호화 스냅샷 저장된다.
export default function CheckoutPage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [total, setTotal] = useState(0);
  const [ship, setShip] = useState({ recipient: '', phone: '', zipcode: '', addr1: '', addr2: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => {
      setLines(getCart());
      setTotal(cartTotal());
    };
    sync();
    return onCartChange(sync);
  }, []);

  const set = (k: keyof typeof ship) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setShip({ ...ship, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        shipping: { ...ship, addr2: ship.addr2 || undefined },
      }),
    });
    setLoading(false);
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? '주문에 실패했습니다');
      return;
    }
    clearCart();
    router.push('/mypage?ordered=1');
    router.refresh();
  }

  if (lines.length === 0) {
    return (
      <main>
        <h1 className="h1">주문서</h1>
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="muted">주문할 상품이 없습니다.</p>
          <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
            쇼핑하러 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1 className="h1">주문서</h1>
      <p className="sub">배송지 정보는 암호화되어 안전하게 저장됩니다.</p>

      <div className="panel" style={{ marginBottom: 16 }}>
        {lines.map((l) => (
          <div className="line" key={l.productId}>
            <div>
              <div className="l-name">{l.name}</div>
              <div className="l-meta">{l.priceKrw.toLocaleString()}원 × {l.qty}</div>
            </div>
            <div className="l-price">{(l.priceKrw * l.qty).toLocaleString()}원</div>
          </div>
        ))}
        <div className="summary">
          <span>총 결제금액</span>
          <span className="total">{total.toLocaleString()}원</span>
        </div>
      </div>

      <form className="panel" onSubmit={submit}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>배송지</h2>
        {err && <div className="alert err">{err}</div>}
        <div className="field">
          <label>받는 분 *</label>
          <input value={ship.recipient} onChange={set('recipient')} required />
        </div>
        <div className="field">
          <label>연락처 *</label>
          <input value={ship.phone} onChange={set('phone')} placeholder="010-1234-5678" required />
        </div>
        <div className="field">
          <label>우편번호 *</label>
          <input value={ship.zipcode} onChange={set('zipcode')} required />
        </div>
        <div className="field">
          <label>주소 *</label>
          <input value={ship.addr1} onChange={set('addr1')} required />
        </div>
        <div className="field">
          <label>상세주소</label>
          <input value={ship.addr2} onChange={set('addr2')} />
        </div>
        <button className="btn block" disabled={loading}>
          {loading ? '주문 처리 중…' : `${total.toLocaleString()}원 결제하기`}
        </button>
      </form>
    </main>
  );
}
