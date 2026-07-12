import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { exportOwnData } from '@/repositories/userRepository';

// 정보주체 열람권(PIPA 제35조) — 본인 개인정보 전체를 JSON으로 내려받기
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const data = await exportOwnData(s.uid);
  if (!data) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-personal-data-${s.uid}.json"`,
    },
  });
}
