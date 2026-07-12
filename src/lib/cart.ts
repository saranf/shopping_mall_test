'use client';

// 클라이언트 장바구니 — 개인정보가 아니므로 localStorage 보관.
// 배송지 등 개인정보는 서버(주문 API)에서만 암호화 저장한다.

export type CartLine = {
  productId: string;
  name: string;
  priceKrw: number;
  qty: number;
};

const KEY = 'ss_cart';
const EVENT = 'ss_cart_changed';

function read(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

export function getCart(): CartLine[] {
  return read();
}

export function cartCount(): number {
  return read().reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(): number {
  return read().reduce((n, l) => n + l.priceKrw * l.qty, 0);
}

export function addToCart(item: Omit<CartLine, 'qty'>, qty = 1): void {
  const lines = read();
  const found = lines.find((l) => l.productId === item.productId);
  if (found) found.qty += qty;
  else lines.push({ ...item, qty });
  write(lines);
}

export function setQty(productId: string, qty: number): void {
  let lines = read();
  if (qty <= 0) lines = lines.filter((l) => l.productId !== productId);
  else lines = lines.map((l) => (l.productId === productId ? { ...l, qty } : l));
  write(lines);
}

export function removeFromCart(productId: string): void {
  write(read().filter((l) => l.productId !== productId));
}

export function clearCart(): void {
  write([]);
}

/** 장바구니 변경 구독 (배지·요약 갱신용) */
export function onCartChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export const CART_EVENT = EVENT;
