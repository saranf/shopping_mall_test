import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { maskEmail, maskName, maskPhone } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';
import { revealProfile } from '@/repositories/userRepository';
import { setUserStatus } from '@/repositories/adminRepository';

// 관리자 회원 조회.
// - 기본: 마스킹 목록 (READ 로그 1건)
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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, emailEnc: true, nameEnc: true, phoneEnc: true,
      role: true, status: true, lastLoginAt: true, dormantAt: true, createdAt: true,
    },
  });
  await logPiiAccess({ actorId: s.uid, subjectUserId: null, action: 'READ', fields: ['email', 'name', 'phone'], reason: '관리자 회원 목록' });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: maskEmail(decrypt(u.emailEnc)),
      name: maskName(decrypt(u.nameEnc)),
      phone: u.phoneEnc ? maskPhone(decrypt(u.phoneEnc)) : null,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      dormantAt: u.dormantAt,
      createdAt: u.createdAt,
    })),
  );
}

const patchSchema = z.object({ userId: z.string(), status: z.enum(['ACTIVE', 'DORMANT']) });

// 회원 상태 변경 — 휴면 전환/해제
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '입력 오류' }, { status: 400 });

  try {
    const res = await setUserStatus(s.uid, parsed.data.userId, parsed.data.status);
    if (!res) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '변경 실패' }, { status: 409 });
  }
}
