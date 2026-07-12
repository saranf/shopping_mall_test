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
  // 계정 존재 여부를 노출하지 않도록 동일 메시지 반환 (사용자 열거 방지)
  const ok = user && user.status === 'ACTIVE' && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!ok || !user) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ id: user.id });
}
