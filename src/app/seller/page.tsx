'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Product = { id: string; name: string; description: string; priceKrw: number; stock: number; sellerId: string | null };

export default function SellerPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', description: '', priceKrw: '', stock: '' });
  const [err, setErr] = useState('');

  const load = () => fetch('/api/products').then((r) => r.json()).then(setProducts).catch(() => setProducts([]));

  useEffect(() => {
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || (d.role !== 'SELLER' && d.role !== 'ADMIN')) { router.push('/'); return; }
      setMe(d);
      load();
    });
  }, [router]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, priceKrw: Number(form.priceKrw), stock: Number(form.stock) }),
    });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? '등록 실패'); return; }
    setForm({ name: '', description: '', priceKrw: '', stock: '' });
    load();
  }
  async function del(id: string) {
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    load();
  }

  if (!me) return <main><p className="muted">불러오는 중…</p></main>;
  const mine = me.role === 'ADMIN' ? products : products.filter((p) => p.sellerId === me.id);

  return (
    <main>
      <h1 className="h1">판매자 상품관리</h1>
      <p className="sub">{me.role === 'ADMIN' ? '전체 상품' : '내가 등록한 상품'} · {mine.length}개</p>

      <form className="panel" onSubmit={add} style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>상품 등록</h2>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>상품명 *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="field"><label>설명</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>가격(원) *</label><input type="number" value={form.priceKrw} onChange={(e) => setForm({ ...form, priceKrw: e.target.value })} required min={1} /></div>
          <div className="field" style={{ flex: 1 }}><label>재고 *</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required min={0} /></div>
        </div>
        <button className="btn block">상품 등록</button>
      </form>

      <div className="panel">
        {mine.length === 0 ? <p className="muted">등록한 상품이 없습니다.</p> :
          mine.map((p) => (
            <div className="line" key={p.id}>
              <div>
                <div className="l-name">{p.name}</div>
                <div className="l-meta">{p.priceKrw.toLocaleString()}원 · 재고 {p.stock}</div>
              </div>
              <button className="btn ghost" style={{ marginLeft: 'auto', padding: '6px 10px' }} onClick={() => del(p.id)}>삭제</button>
            </div>
          ))}
      </div>
    </main>
  );
}
