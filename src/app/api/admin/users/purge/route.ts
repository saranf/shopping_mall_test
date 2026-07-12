import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { purgeExpired } from '@/repositories/adminRepository';

// 보관기간 만료 탈퇴 회원 완전 파기(하드 삭제).
export async function POST() {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const res = await purgeExpired(s.uid);
  return NextResponse.json({ ok: true, ...res });
}
