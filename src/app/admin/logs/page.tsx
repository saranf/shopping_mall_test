'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Log = { seq: number; action: string; actorId: string | null; subjectUserId: string | null; fields: string; reason: string | null; ip: string | null; at: string; hash: string };
type Data = { integrity: { ok: boolean; brokenAtSeq: number | null; total: number }; logs: Log[] };

const ACTION_COLOR: Record<string, string> = { READ: '#767676', REVEAL: '#e02020', EXPORT: '#0064ff', UPDATE: '#02a94c', PROVIDE: '#e08a00', DELETE: '#b0208c' };

export default function AdminLogsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/admin/logs')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => router.push('/'));
  }, [router]);

  if (!data) return <main><p className="muted">불러오는 중…</p></main>;

  return (
    <main>
      <h1 className="h1">개인정보 접근 감사로그</h1>
      <p className="sub">PIPA 제29조 안전조치 — 접근기록 보관·위변조 방지 (해시체인)</p>

      <div className={`alert ${data.integrity.ok ? 'ok' : 'err'}`}>
        {data.integrity.ok
          ? `✓ 체인 무결성 정상 — 총 ${data.integrity.total}건, 위·변조 없음`
          : `⚠ 체인 손상 감지 — seq ${data.integrity.brokenAtSeq} 이후 위·변조 의심`}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: 8 }}>seq</th><th style={{ padding: 8 }}>행위</th><th style={{ padding: 8 }}>필드</th>
              <th style={{ padding: 8 }}>사유</th><th style={{ padding: 8 }}>시각</th><th style={{ padding: 8 }}>해시</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.seq} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: 8 }}>{l.seq}</td>
                <td style={{ padding: 8, fontWeight: 700, color: ACTION_COLOR[l.action] ?? 'var(--ink)' }}>{l.action}</td>
                <td style={{ padding: 8 }}>{l.fields}</td>
                <td style={{ padding: 8 }}>{l.reason ?? '-'}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{new Date(l.at).toLocaleString('ko-KR')}</td>
                <td style={{ padding: 8, fontFamily: 'monospace', color: 'var(--muted)' }}>{l.hash}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
