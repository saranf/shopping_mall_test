'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? '로그인에 실패했습니다');
      return;
    }
    router.push('/mypage');
    router.refresh();
  }

  return (
    <main className="form-narrow">
      <h1 className="h1">로그인</h1>
      <p className="sub">회원 정보로 로그인하세요.</p>
      <form className="panel" onSubmit={submit}>
        {err && <div className="alert err">{err}</div>}
        <div className="field">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn block" disabled={loading}>
          {loading ? '확인 중…' : '로그인'}
        </button>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          아직 회원이 아니세요? <Link href="/signup" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>회원가입</Link>
        </p>
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 12, textAlign: 'center' }}>
        시드 계정: customer@example.com / customer1234
      </p>
    </main>
  );
}
