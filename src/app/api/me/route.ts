import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/auth';
import { getMaskedProfile, withdrawUser } from '@/repositories/userRepository';

// 내 정보 조회 — 항상 마스킹 상태로 반환
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const profile = await getMaskedProfile(s.uid, s.uid);
  if (!profile) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
  return NextResponse.json(profile);
}

// 회원 탈퇴 — 개인정보 파기 (정보주체 삭제권)
export async function DELETE() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  await withdrawUser(s.uid);
  clearSession();
  return NextResponse.json({ ok: true, message: '개인정보가 파기되었습니다' });
}
