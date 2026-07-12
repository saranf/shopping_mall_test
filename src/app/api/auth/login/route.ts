import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findByEmail } from '@/repositories/userRepository';
import { verifyPassword, createSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '입력 오류' }, { status: 400 });

  const user = await findByEmail(parsed.data.email);
  // 탈퇴 회원은 로그인 불가. 휴면(DORMANT)은 로그인 시 자동 해제(재활성).
  const loginable = user && user.status !== 'WITHDRAWN';
  const ok = loginable && (await verifyPassword(parsed.data.password, user!.passwordHash));
  if (!ok || !user) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
  }

  // 휴면 계정이면 접속과 동시에 해제
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), ...(user.status === 'DORMANT' ? { status: 'ACTIVE', dormantAt: null } : {}) },
  });
  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ id: user.id, reactivated: user.status === 'DORMANT' });
}
