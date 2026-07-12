import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getMaskedProfile, revealProfile } from '@/repositories/userRepository';

// 관리자 회원 조회.
// - 기본: 마스킹 목록 (READ 로그)
// - ?reveal=<userId>&reason=<사유>: 특정 회원 평문 열람 (REVEAL 로그, 사유 필수)
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const url = new URL(req.url);
  const revealId = url.searchParams.get('reveal');
  const reason = url.searchParams.get('reason') ?? '';

  if (revealId) {
    if (!reason.trim()) return NextResponse.json({ error: '평문 열람에는 사유가 필요합니다' }, { status: 400 });
    const data = await revealProfile(revealId, s.uid, reason);
    if (!data) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
    return NextResponse.json(data);
  }

  const ids = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true } });
  const list = await Promise.all(ids.map((u) => getMaskedProfile(u.id, s.uid)));
  return NextResponse.json(list.filter(Boolean));
}
