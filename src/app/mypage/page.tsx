'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Profile = { id: string; name: string; email: string; phone: string | null; rrn: string | null; gender: string | null; birthDate: string | null; role: string; status: string; createdAt: string };
type Order = { id: string; status: string; totalKrw: number; createdAt: string; items: { qty: number }[] };
type Address = { id: string; label: string | null; recipient: string; phone: string; zipcode: string; addr1: string; isDefault: boolean };
type Inquiry = { id: string; category: string; title: string; status: string; answer: string | null; createdAt: string; productName: string | null };
type Payment = { id: string; type: string; cardBrand: string | null; cardMasked: string | null; bankName: string | null; accountMasked: string | null; isDefault: boolean };
type Provision = { id: string; recipientOrg: string; items: string; purpose: string; basis: string; providedAt: string };

const STATUS_LABEL: Record<string, string> = { PENDING: '결제대기', PAID: '결제완료', SHIPPED: '배송중', DONE: '배송완료', CANCELLED: '취소' };

export default function MyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'orders' | 'addresses' | 'payments' | 'inquiries' | 'privacy'>('orders');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState('');

  const reloadProfile = () => fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setProfile(d); });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ordered')) setNotice('주문이 완료되었습니다.');
  }, []);

  useEffect(() => {
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then((d) => { if (!d) router.push('/login'); else setProfile(d); });
  }, [router]);

  if (!profile) return <main><p className="muted">불러오는 중…</p></main>;

  return (
    <main>
      <h1 className="h1">마이페이지</h1>
      <p className="sub">
        {profile.name}님 · <span className="pill">{profile.role}</span> · 가입일 {new Date(profile.createdAt).toLocaleDateString('ko-KR')}
      </p>
      {notice && <div className="alert ok">{notice}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>내 정보 (마스킹 표시)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <div><b>이메일</b><br />{profile.email}</div>
          <div><b>이름</b><br />{profile.name}</div>
          <div><b>휴대폰</b><br />{profile.phone ?? '-'}</div>
          <div><b>성별</b><br />{profile.gender ?? '-'}</div>
          <div><b>생년월일</b><br />{profile.birthDate ?? '-'}</div>
          <div><b>주민번호</b><br />{profile.rrn ?? '-'}</div>
        </div>
      </div>

      {(profile.role === 'ADMIN' || profile.role === 'SELLER') && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {profile.role === 'SELLER' && <Link href="/seller" className="btn ghost">판매자 상품관리</Link>}
          {profile.role === 'ADMIN' && <Link href="/admin/orders" className="btn ghost">주문·배송 관리</Link>}
          {profile.role === 'ADMIN' && <Link href="/admin/logs" className="btn ghost">개인정보 접근로그</Link>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 16, flexWrap: 'wrap' }}>
        {([['orders', '주문내역'], ['addresses', '배송지'], ['payments', '결제수단'], ['inquiries', '1:1 문의'], ['privacy', '개인정보']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '10px 14px', border: 0, background: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: tab === k ? 800 : 500, color: tab === k ? 'var(--brand-dark)' : 'var(--muted)',
              borderBottom: tab === k ? '2px solid var(--brand)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'addresses' && <AddressesTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'inquiries' && <InquiriesTab />}
      {tab === 'privacy' && <PrivacyTab profile={profile} reloadProfile={reloadProfile} onWithdraw={() => router.push('/')} setNotice={setNotice} />}
    </main>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { fetch('/api/orders').then((r) => r.json()).then(setOrders).catch(() => setOrders([])); }, []);
  if (!orders) return <p className="muted">불러오는 중…</p>;
  if (orders.length === 0)
    return <div className="panel" style={{ textAlign: 'center' }}><p className="muted">주문 내역이 없습니다.</p><Link href="/" className="btn ghost">쇼핑하러 가기</Link></div>;
  return (
    <div className="panel">
      {orders.map((o) => (
        <div className="line" key={o.id}>
          <div>
            <div className="l-name">주문 {o.id.slice(0, 8)}</div>
            <div className="l-meta">{new Date(o.createdAt).toLocaleString('ko-KR')} · 상품 {o.items.reduce((n, i) => n + i.qty, 0)}개</div>
          </div>
          <span className="pill" style={{ marginLeft: 'auto' }}>{STATUS_LABEL[o.status] ?? o.status}</span>
          <div className="l-price" style={{ minWidth: 90, textAlign: 'right' }}>{o.totalKrw.toLocaleString()}원</div>
        </div>
      ))}
    </div>
  );
}

function AddressesTab() {
  const [rows, setRows] = useState<Address[] | null>(null);
  const [form, setForm] = useState({ label: '', recipient: '', phone: '', zipcode: '', addr1: '', addr2: '', isDefault: false });
  const [err, setErr] = useState('');
  const load = () => fetch('/api/addresses').then((r) => r.json()).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/addresses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, label: form.label || undefined, addr2: form.addr2 || undefined }),
    });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? '저장 실패'); return; }
    setForm({ label: '', recipient: '', phone: '', zipcode: '', addr1: '', addr2: '', isDefault: false });
    load();
  }
  async function del(id: string) { await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' }); load(); }

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        {rows === null ? <p className="muted">불러오는 중…</p> : rows.length === 0 ? <p className="muted">등록된 배송지가 없습니다.</p> :
          rows.map((a) => (
            <div className="line" key={a.id}>
              <div>
                <div className="l-name">{a.recipient} {a.isDefault && <span className="pill">기본</span>} {a.label && <span className="muted">({a.label})</span>}</div>
                <div className="l-meta">{a.phone} · [{a.zipcode}] {a.addr1}</div>
              </div>
              <button className="btn ghost" style={{ marginLeft: 'auto', padding: '6px 10px' }} onClick={() => del(a.id)}>삭제</button>
            </div>
          ))}
      </div>
      <form className="panel" onSubmit={add}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>배송지 추가</h2>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>배송지 이름 (선택)</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="집, 회사 등" /></div>
        <div className="field"><label>받는 분 *</label><input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} required /></div>
        <div className="field"><label>연락처 *</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
        <div className="field"><label>우편번호 *</label><input value={form.zipcode} onChange={(e) => setForm({ ...form, zipcode: e.target.value })} required /></div>
        <div className="field"><label>주소 *</label><input value={form.addr1} onChange={(e) => setForm({ ...form, addr1: e.target.value })} required /></div>
        <div className="field"><label>상세주소</label><input value={form.addr2} onChange={(e) => setForm({ ...form, addr2: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /><span>기본 배송지로 설정</span></label>
        <button className="btn block" style={{ marginTop: 8 }}>배송지 저장</button>
      </form>
    </>
  );
}

function PaymentsTab() {
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [mode, setMode] = useState<'CARD' | 'BANK'>('CARD');
  const [card, setCard] = useState({ cardBrand: 'VISA', cardNumber: '', cardExpiry: '', isDefault: false });
  const [bank, setBank] = useState({ bankName: '', account: '', holder: '', isDefault: false });
  const [err, setErr] = useState('');
  const load = () => fetch('/api/payment-methods').then((r) => r.json()).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const body = mode === 'CARD'
      ? { type: 'CARD', cardBrand: card.cardBrand, cardNumber: card.cardNumber.replace(/\D/g, ''), cardExpiry: card.cardExpiry || undefined, isDefault: card.isDefault }
      : { type: 'BANK', bankName: bank.bankName, account: bank.account.replace(/\D/g, ''), holder: bank.holder, isDefault: bank.isDefault };
    const res = await fetch('/api/payment-methods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? '저장 실패'); return; }
    setCard({ cardBrand: 'VISA', cardNumber: '', cardExpiry: '', isDefault: false });
    setBank({ bankName: '', account: '', holder: '', isDefault: false });
    load();
  }
  async function del(id: string) { await fetch(`/api/payment-methods?id=${id}`, { method: 'DELETE' }); load(); }

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        {rows === null ? <p className="muted">불러오는 중…</p> : rows.length === 0 ? <p className="muted">등록된 결제수단이 없습니다.</p> :
          rows.map((p) => (
            <div className="line" key={p.id}>
              <div>
                <div className="l-name">
                  {p.type === 'CARD' ? `${p.cardBrand ?? '카드'} ${p.cardMasked}` : `${p.bankName} ${p.accountMasked}`}
                  {p.isDefault && <span className="pill" style={{ marginLeft: 6 }}>기본</span>}
                </div>
                <div className="l-meta">{p.type === 'CARD' ? '신용/체크카드' : '환불 계좌'} · 암호화 저장</div>
              </div>
              <button className="btn ghost" style={{ marginLeft: 'auto', padding: '6px 10px' }} onClick={() => del(p.id)}>삭제</button>
            </div>
          ))}
      </div>
      <form className="panel" onSubmit={add}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>결제수단 등록</h2>
        {err && <div className="alert err">{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn ${mode === 'CARD' ? '' : 'ghost'}`} onClick={() => setMode('CARD')}>카드</button>
          <button type="button" className={`btn ${mode === 'BANK' ? '' : 'ghost'}`} onClick={() => setMode('BANK')}>계좌</button>
        </div>
        {mode === 'CARD' ? (
          <>
            <div className="field"><label>카드사</label>
              <select value={card.cardBrand} onChange={(e) => setCard({ ...card, cardBrand: e.target.value })} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 }}>
                <option>VISA</option><option>MASTER</option><option>BC</option><option>삼성</option><option>현대</option>
              </select>
            </div>
            <div className="field"><label>카드번호 * (암호화 저장)</label><input value={card.cardNumber} onChange={(e) => setCard({ ...card, cardNumber: e.target.value })} placeholder="숫자 13~16자리" required /></div>
            <div className="field"><label>유효기간 (MM/YY)</label><input value={card.cardExpiry} onChange={(e) => setCard({ ...card, cardExpiry: e.target.value })} placeholder="12/28" /></div>
            <label className="check"><input type="checkbox" checked={card.isDefault} onChange={(e) => setCard({ ...card, isDefault: e.target.checked })} /><span>기본 결제수단</span></label>
          </>
        ) : (
          <>
            <div className="field"><label>은행</label><input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} placeholder="국민은행" required /></div>
            <div className="field"><label>계좌번호 * (암호화 저장)</label><input value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value })} placeholder="숫자만" required /></div>
            <div className="field"><label>예금주 *</label><input value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} required /></div>
            <label className="check"><input type="checkbox" checked={bank.isDefault} onChange={(e) => setBank({ ...bank, isDefault: e.target.checked })} /><span>기본 결제수단</span></label>
          </>
        )}
        <button className="btn block" style={{ marginTop: 8 }}>결제수단 저장</button>
      </form>
    </>
  );
}

function InquiriesTab() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [form, setForm] = useState({ category: 'PRODUCT', title: '', body: '', name: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const load = () => fetch('/api/inquiries').then((r) => r.json()).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/inquiries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, phone: form.phone || undefined, email: form.email || undefined }),
    });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? '등록 실패'); return; }
    setForm({ category: 'PRODUCT', title: '', body: '', name: '', phone: '', email: '' });
    load();
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        {rows === null ? <p className="muted">불러오는 중…</p> : rows.length === 0 ? <p className="muted">등록한 문의가 없습니다.</p> :
          rows.map((q) => (
            <div className="line" key={q.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="pill">{q.category}</span>
                <b>{q.title}</b>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{q.status === 'ANSWERED' ? '답변완료' : '답변대기'}</span>
              </div>
              {q.answer && <div className="l-meta" style={{ marginTop: 6 }}>↳ {q.answer}</div>}
            </div>
          ))}
      </div>
      <form className="panel" onSubmit={add}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>1:1 문의하기</h2>
        {err && <div className="alert err">{err}</div>}
        <div className="field">
          <label>문의 유형</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 }}>
            <option value="PRODUCT">상품문의</option><option value="DELIVERY">배송문의</option>
            <option value="REFUND">환불/교환</option><option value="ETC">기타</option>
          </select>
        </div>
        <div className="field"><label>제목 *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field"><label>내용 *</label><input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></div>
        <div className="field"><label>이름 * (답변 연락용 · 암호화 저장)</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="field"><label>연락처</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" /></div>
        <div className="field"><label>이메일</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <button className="btn block" style={{ marginTop: 8 }}>문의 등록</button>
      </form>
    </>
  );
}

function PrivacyTab({ profile, reloadProfile, onWithdraw, setNotice }: { profile: Profile; reloadProfile: () => void; onWithdraw: () => void; setNotice: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({ phone: '', gender: '', birthDate: '' });
  const [provisions, setProvisions] = useState<Provision[] | null>(null);

  useEffect(() => { fetch('/api/me/provisions').then((r) => r.json()).then(setProvisions).catch(() => setProvisions([])); }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const patch: Record<string, string> = {};
    if (edit.phone) patch.phone = edit.phone;
    if (edit.gender) patch.gender = edit.gender;
    if (edit.birthDate) patch.birthDate = edit.birthDate;
    if (Object.keys(patch).length === 0) { setNotice('변경할 항목을 입력하세요.'); return; }
    await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    setEdit({ phone: '', gender: '', birthDate: '' });
    reloadProfile();
    setNotice('내 정보가 수정되었습니다.');
  }

  async function erase(field: string) {
    if (!confirm(`${field} 항목을 파기하시겠습니까? 되돌릴 수 없습니다.`)) return;
    await fetch('/api/me/erase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field }) });
    reloadProfile();
    setNotice(`${field} 항목이 파기되었습니다.`);
  }

  async function withdraw() {
    if (!confirm('정말 탈퇴하시겠습니까? 개인정보가 즉시 파기됩니다.')) return;
    setBusy(true);
    await fetch('/api/me', { method: 'DELETE' });
    setBusy(false);
    onWithdraw();
  }

  return (
    <>
      <form className="panel" onSubmit={saveProfile} style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>내 정보 수정 (이용)</h2>
        <p className="muted" style={{ fontSize: 13 }}>입력한 항목만 변경됩니다. 현재: 휴대폰 {profile.phone ?? '-'} · 성별 {profile.gender ?? '-'} · 생년월일 {profile.birthDate ?? '-'}</p>
        <div className="field"><label>휴대폰</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="010-1234-5678" /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>성별</label>
            <select value={edit.gender} onChange={(e) => setEdit({ ...edit, gender: e.target.value })} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14 }}>
              <option value="">변경 안 함</option><option value="M">남성</option><option value="F">여성</option><option value="OTHER">기타</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>생년월일</label><input type="date" value={edit.birthDate} onChange={(e) => setEdit({ ...edit, birthDate: e.target.value })} /></div>
        </div>
        <button className="btn block">정보 수정</button>
      </form>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>개인정보 제3자 제공 내역</h2>
        {provisions === null ? <p className="muted">불러오는 중…</p> : provisions.length === 0 ? <p className="muted">제3자 제공 내역이 없습니다.</p> :
          provisions.map((p) => (
            <div className="line" key={p.id}>
              <div>
                <div className="l-name">{p.recipientOrg}</div>
                <div className="l-meta">제공항목: {p.items} · 목적: {p.purpose} · 근거: {p.basis}</div>
              </div>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{new Date(p.providedAt).toLocaleDateString('ko-KR')}</span>
            </div>
          ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>항목별 파기</h2>
        <p className="muted" style={{ fontSize: 13 }}>목적을 달성한 개인정보 항목을 회원 유지한 채 즉시 파기합니다.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {profile.rrn && <button className="btn danger" onClick={() => erase('rrn')}>주민번호 파기</button>}
          {profile.phone && <button className="btn danger" onClick={() => erase('phone')}>휴대폰 파기</button>}
          {profile.gender && <button className="btn danger" onClick={() => erase('gender')}>성별 파기</button>}
          {profile.birthDate && <button className="btn danger" onClick={() => erase('birthDate')}>생년월일 파기</button>}
          {!profile.rrn && !profile.phone && !profile.gender && !profile.birthDate && <span className="muted">파기할 선택 항목이 없습니다.</span>}
        </div>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>정보주체 권리 (PIPA)</h2>
        <p className="muted" style={{ fontSize: 14 }}>본인 개인정보를 내려받거나(열람권), 회원 탈퇴로 전체 파기할 수 있습니다.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <a className="btn ghost block" href="/api/me/export" onClick={() => setNotice('개인정보 사본을 내려받았습니다.')}>내 개인정보 내려받기 (JSON)</a>
          <button className="btn danger block" onClick={withdraw} disabled={busy}>{busy ? '처리 중…' : '회원 탈퇴 · 개인정보 전체 파기'}</button>
        </div>
      </div>
    </>
  );
}
