'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCart, setQty, removeFromCart, cartTotal, onCartChange, type CartLine } from '@/lib/cart';

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const sync = () => {
      setLines(getCart());
      setTotal(cartTotal());
    };
    sync();
    return onCartChange(sync);
  }, []);

  if (lines.length === 0) {
    return (
      <main>
        <h1 className="h1">장바구니</h1>
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="muted">장바구니가 비어 있습니다.</p>
          <Link href="/" className="btn ghost" style={{ marginTop: 8 }}>
            쇼핑하러 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1 className="h1">장바구니</h1>
      <p className="sub">{lines.length}개 상품</p>
      <div className="panel">
        {lines.map((l) => (
          <div className="line" key={l.productId}>
            <div>
              <div className="l-name">{l.name}</div>
              <div className="l-meta">{l.priceKrw.toLocaleString()}원</div>
            </div>
            <div className="qty" style={{ marginLeft: 'auto' }}>
              <button onClick={() => setQty(l.productId, l.qty - 1)}>−</button>
              <span>{l.qty}</span>
              <button onClick={() => setQty(l.productId, l.qty + 1)}>+</button>
            </div>
            <div className="l-price" style={{ minWidth: 90, textAlign: 'right' }}>
              {(l.priceKrw * l.qty).toLocaleString()}원
            </div>
            <button className="btn ghost" style={{ padding: '6px 10px' }} onClick={() => removeFromCart(l.productId)}>
              삭제
            </button>
          </div>
        ))}
        <div className="summary">
          <span>결제 예상 금액</span>
          <span className="total">{total.toLocaleString()}원</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link href="/" className="btn ghost">
          계속 쇼핑
        </Link>
        <Link href="/checkout" className="btn" style={{ marginLeft: 'auto' }}>
          주문하기
        </Link>
      </div>
    </main>
  );
}
