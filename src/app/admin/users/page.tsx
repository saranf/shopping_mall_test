'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type User = { id: string; email: string; name: string; phone: string | null; role: string; status: string; lastLoginAt: string | null; dormantAt: string | null; createdAt: string };
type Batch = { id: string; recipientOrg: string; purpose: string; basis: string; items: string; count: number; createdAt: string };
type BundleResult = { batchId: string | null; count: number; excludedCount: number; rows: { id: string; name: string; phone: string | null }[] };

const STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '활성', color: '#02a94c' },
  DORMANT: { label: '휴면', color: '#e08a00' },
  WITHDRAWN: { label: '탈퇴', color: '#b0208c' },
};
const ITEM_OPTIONS = ['이름', '연락처', '이메일'];

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [days, setDays] = useState('365');

  // 제공 묶기 폼
  const [prov, setProv] = useState({ recipientOrg: '', purpose: '', basis: '동의' as '동의' | '법령' | '계약이행' });
  const [provItems, setProvItems] = useState<Record<string, boolean>>({ 이름: true, 연락처: true, 이메일: false });
  const [result, setResult] = useState<BundleResult | null>(null);

  const loadUsers = () => fetch('/api/admin/users').then((r) => (r.ok ? r.json() : Promise.reject())).then(setUsers).catch(() => router.push('/'));
  const loadBatches = () => fetch('/api/admin/provisions').then((r) => (r.ok ? r.json() : [])).then(setBatches).catch(() => setBatches([]));
  useEffect(() => { loadUsers(); loadBatches(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function reveal(u: User) {
    const reason = prompt(`[${u.name}] 평문 열람 사유를 입력하세요 (감사로그 기록)`);
    if (!reason?.trim()) return;
    const r = await fetch(`/api/admin/users?reveal=${u.id}&reason=${encodeURIComponent(reason)}`);
    const d = await r.json();
    if (!r.ok) { setNotice(d.error ?? '열람 실패'); return; }
    alert(`평문 열람 (감사로그 REVEAL 기록됨)\n\n이름: ${d.name}\n이메일: ${d.email}\n연락처: ${d.phone ?? '-'}\n주민번호: ${d.rrn ?? '-'}\n성별: ${d.gender ?? '-'}\n생년월일: ${d.birthDate ?? '-'}`);
  }

  async function toggleStatus(u: User) {
    const next = u.status === 'DORMANT' ? 'ACTIVE' : 'DORMANT';
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, status: next }) });
    setNotice(`${u.name} → ${next === 'DORMANT' ? '휴면 전환' : '휴면 해제'}`);
    loadUsers();
  }

  async function batchDormant() {
    const d = Number(days) || 365;
    const r = await fetch('/api/admin/users/dormant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: d }) });
    const j = await r.json();
    setNotice(`미접속 ${d}일 초과 ${j.count}명 휴면 전환`);
    loadUsers();
  }

  async function purge() {
    if (!confirm('보관기간이 만료된 탈퇴 회원을 완전 파기합니다. 되돌릴 수 없습니다.')) return;
    const r = await fetch('/api/admin/users/purge', { method: 'POST' });
    const j = await r.json();
    setNotice(`완전 파기 ${j.count}건`);
    loadUsers();
  }

  async function bundle() {
    setResult(null);
    const items = ITEM_OPTIONS.filter((i) => provItems[i]);
    if (selectedIds.length === 0) { setNotice('묶을 회원을 선택하세요'); return; }
    if (!prov.recipientOrg || !prov.purpose || items.length === 0) { setNotice('제공받는 자·목적·항목을 입력하세요'); return; }
    const r = await fetch('/api/admin/provisions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: selectedIds, ...prov, items }),
    });
    const j: BundleResult = await r.json();
    setResult(j);
    setNotice(j.batchId ? `제3자 제공 완료 — ${j.count}명 묶음(제외 ${j.excludedCount}명)` : `제공 대상 없음(동의 미보유 ${j.excludedCount}명 제외)`);
    loadBatches();
  }

  if (!users) return <main><p className="muted">불러오는 중…</p></main>;

  return (
    <main>
      <h1 className="h1">회원 관리</h1>
      <p className="sub">휴면 전환·해제, 보관기간 만료 파기, 평문 열람(사유), 제3자 제공 묶기</p>
      {notice && <div className="alert ok">{notice}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/admin/orders" className="btn ghost">주문·배송 관리</Link>
        <Link href="/admin/logs" className="btn ghost">개인정보 접근로그</Link>
        <span style={{ flex: 1 }} />
        <input value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 70, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
        <button className="btn ghost" onClick={batchDormant}>일괄 휴면(미접속일)</button>
        <button className="btn danger" onClick={purge}>만료 회원 완전 파기</button>
      </div>

      <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: 8 }}>선택</th><th style={{ padding: 8 }}>이름</th><th style={{ padding: 8 }}>이메일</th>
              <th style={{ padding: 8 }}>연락처</th><th style={{ padding: 8 }}>권한</th><th style={{ padding: 8 }}>상태</th>
              <th style={{ padding: 8 }}>최근접속</th><th style={{ padding: 8 }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: 8 }}>
                  <input type="checkbox" disabled={u.status === 'WITHDRAWN'} checked={!!selected[u.id]}
                    onChange={(e) => setSelected({ ...selected, [u.id]: e.target.checked })} />
                </td>
                <td style={{ padding: 8 }}>{u.name}</td>
                <td style={{ padding: 8 }}>{u.email}</td>
                <td style={{ padding: 8 }}>{u.phone ?? '-'}</td>
                <td style={{ padding: 8 }}>{u.role}</td>
                <td style={{ padding: 8, fontWeight: 700, color: STATUS[u.status]?.color }}>{STATUS[u.status]?.label ?? u.status}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '-'}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 8px', marginRight: 4 }} onClick={() => reveal(u)}>열람</button>
                  {u.status !== 'WITHDRAWN' && (
                    <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => toggleStatus(u)}>
                      {u.status === 'DORMANT' ? '휴면해제' : '휴면전환'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>제3자 제공 묶기 — 선택 {selectedIds.length}명</h2>
        <p className="muted" style={{ fontSize: 13 }}>선택 회원의 개인정보를 하나의 제공 건으로 묶어 대장·감사로그에 기록합니다. 근거가 &lsquo;동의&rsquo;면 제3자 제공 동의 회원만 포함됩니다.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}><label>제공받는 자</label><input value={prov.recipientOrg} onChange={(e) => setProv({ ...prov, recipientOrg: e.target.value })} placeholder="마케팅제휴사" /></div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}><label>제공 목적</label><input value={prov.purpose} onChange={(e) => setProv({ ...prov, purpose: e.target.value })} placeholder="제휴 마케팅" /></div>
          <div className="field" style={{ minWidth: 120 }}><label>제공 근거</label>
            <select value={prov.basis} onChange={(e) => setProv({ ...prov, basis: e.target.value as typeof prov.basis })} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 }}>
              <option value="동의">동의</option><option value="법령">법령</option><option value="계약이행">계약이행</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
          <span className="muted" style={{ fontSize: 13 }}>제공 항목:</span>
          {ITEM_OPTIONS.map((i) => (
            <label key={i} className="check" style={{ margin: 0 }}>
              <input type="checkbox" checked={!!provItems[i]} onChange={(e) => setProvItems({ ...provItems, [i]: e.target.checked })} /><span>{i}</span>
            </label>
          ))}
        </div>
        <button className="btn" onClick={bundle}>선택 회원 제3자 제공(묶기)</button>

        {result && result.rows.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>제공 명세서 (마스킹) · 배치 {result.batchId?.slice(0, 8)}</div>
            {result.rows.map((r) => (
              <div className="line" key={r.id} style={{ padding: '8px 0' }}>
                <div className="l-name">{r.name}</div>
                <div className="l-meta" style={{ marginLeft: 12 }}>{r.phone ?? '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>제3자 제공 이력</h2>
        {batches.length === 0 ? <p className="muted">제공 이력이 없습니다.</p> :
          batches.map((b) => (
            <div className="line" key={b.id}>
              <div>
                <div className="l-name">{b.recipientOrg} <span className="pill">{b.count}명</span></div>
                <div className="l-meta">목적: {b.purpose} · 근거: {b.basis} · 항목: {b.items}</div>
              </div>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{new Date(b.createdAt).toLocaleString('ko-KR')}</span>
            </div>
          ))}
      </div>
    </main>
  );
}
