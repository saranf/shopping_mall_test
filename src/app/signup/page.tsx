'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 회원가입 — PIPA 항목별 개별 동의(필수/선택 분리). 주민번호 수집 시 별도 동의.
type Consents = {
  TERMS: boolean;
  PRIVACY_REQUIRED: boolean;
  MARKETING: boolean;
  THIRD_PARTY_PROVISION: boolean;
  SENSITIVE_UNIQUE_ID: boolean;
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', rrn: '' });
  const [consents, setConsents] = useState<Consents>({
    TERMS: false,
    PRIVACY_REQUIRED: false,
    MARKETING: false,
    THIRD_PARTY_PROVISION: false,
    SENSITIVE_UNIQUE_ID: false,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const toggle = (k: keyof Consents) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConsents({ ...consents, [k]: e.target.checked });

  const allChecked = Object.values(consents).every(Boolean);
  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.checked;
    setConsents({ TERMS: v, PRIVACY_REQUIRED: v, MARKETING: v, THIRD_PARTY_PROVISION: v, SENSITIVE_UNIQUE_ID: v });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const body = {
      email: form.email,
      password: form.password,
      name: form.name,
      phone: form.phone || undefined,
      rrn: form.rrn || undefined,
      consents,
    };
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? '가입에 실패했습니다');
      return;
    }
    router.push('/mypage');
    router.refresh();
  }

  return (
    <main className="form-narrow">
      <h1 className="h1">회원가입</h1>
      <p className="sub">개인정보는 암호화되어 저장되며, 필수 동의 항목만 처리에 사용됩니다.</p>
      <form className="panel" onSubmit={submit}>
        {err && <div className="alert err">{err}</div>}

        <div className="field">
          <label>이메일 *</label>
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div className="field">
          <label>비밀번호 *</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          <span className="hint">8자 이상</span>
        </div>
        <div className="field">
          <label>이름 *</label>
          <input value={form.name} onChange={set('name')} required />
        </div>
        <div className="field">
          <label>휴대폰 (선택)</label>
          <input value={form.phone} onChange={set('phone')} placeholder="010-1234-5678" />
        </div>
        <div className="field">
          <label>주민등록번호 (선택 · 본인인증용)</label>
          <input value={form.rrn} onChange={set('rrn')} placeholder="000000-0000000" />
          <span className="hint">입력 시 아래 고유식별정보 처리 동의가 필요합니다. 최소수집 원칙상 비워두어도 됩니다.</span>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0 14px' }} />

        <label className="check" style={{ fontWeight: 700 }}>
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span>전체 동의</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.TERMS} onChange={toggle('TERMS')} />
          <span><span className="req">[필수]</span> 이용약관 동의</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.PRIVACY_REQUIRED} onChange={toggle('PRIVACY_REQUIRED')} />
          <span><span className="req">[필수]</span> 개인정보 수집·이용 동의</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.MARKETING} onChange={toggle('MARKETING')} />
          <span><span className="opt">[선택]</span> 마케팅 정보 수신 동의</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.THIRD_PARTY_PROVISION} onChange={toggle('THIRD_PARTY_PROVISION')} />
          <span><span className="opt">[선택]</span> 제3자 제공 동의</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={consents.SENSITIVE_UNIQUE_ID} onChange={toggle('SENSITIVE_UNIQUE_ID')} />
          <span><span className="opt">[선택]</span> 고유식별정보(주민번호 등) 처리 동의</span>
        </label>

        <button className="btn block" disabled={loading} style={{ marginTop: 14 }}>
          {loading ? '가입 중…' : '가입하기'}
        </button>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          이미 회원이세요? <Link href="/login" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>로그인</Link>
        </p>
      </form>
    </main>
  );
}
