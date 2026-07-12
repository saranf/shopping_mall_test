'use client';

import { useState } from 'react';
import { addToCart } from '@/lib/cart';

// 상품 카드용 담기 버튼 — 클라이언트 장바구니(localStorage)에만 반영.
export default function AddToCart({
  productId,
  name,
  priceKrw,
  disabled,
}: {
  productId: string;
  name: string;
  priceKrw: number;
  disabled?: boolean;
}) {
  const [added, setAdded] = useState(false);

  function handle() {
    addToCart({ productId, name, priceKrw });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button className="btn block ghost" onClick={handle} disabled={disabled} style={{ marginTop: 6 }}>
      {disabled ? '품절' : added ? '담김 ✓' : '장바구니 담기'}
    </button>
  );
}
