'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Order = { id: string; status: string; totalKrw: number; createdAt: string; recipient: string; addr1: string };
const STATUS_LABEL: Record<string, string> = { PENDING: '결제대기', PAID: '결제완료', SHIPPED: '배송중', DONE: '배송완료', CANCELLED: '취소' };

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = () =>
    fetch('/api/admin/orders')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOrders)
      .catch(() => router.push('/'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ship(id: string) {
    setBusy(id);
    await fetch(`/api/orders/${id}/ship`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier: 'CJ대한통운' }),
    });
    setBusy('');
    load();
  }

  if (!orders) return <main><p className="muted">불러오는 중…</p></main>;

  return (
    <main>
      <h1 className="h1">주문 · 배송 관리</h1>
      <p className="sub">배송 처리 시 배송지(이름·연락처·주소)를 택배사에 <b>제3자 제공</b>하고 제공 대장·감사로그에 기록합니다.</p>
      <div className="panel">
        {orders.length === 0 ? <p className="muted">주문이 없습니다.</p> :
          orders.map((o) => (
            <div className="line" key={o.id}>
              <div>
                <div className="l-name">{o.recipient} · {o.addr1}</div>
                <div className="l-meta">주문 {o.id.slice(0, 8)} · {o.totalKrw.toLocaleString()}원 · {new Date(o.createdAt).toLocaleDateString('ko-KR')}</div>
              </div>
              <span className="pill" style={{ marginLeft: 'auto' }}>{STATUS_LABEL[o.status] ?? o.status}</span>
              {o.status === 'PAID' || o.status === 'PENDING' ? (
                <button className="btn" style={{ padding: '6px 12px' }} disabled={busy === o.id} onClick={() => ship(o.id)}>
                  {busy === o.id ? '처리 중…' : '배송처리(제3자 제공)'}
                </button>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>제공완료</span>
              )}
            </div>
          ))}
      </div>
    </main>
  );
}
