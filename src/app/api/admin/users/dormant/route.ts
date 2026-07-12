import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { markDormantInactive } from '@/repositories/adminRepository';

// 장기 미접속 회원 일괄 휴면 전환 (개인정보 유효기간제 — 분리보관).
const schema = z.object({ days: z.number().int().positive().default(365) });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const days = parsed.success ? parsed.data.days : 365;

  const res = await markDormantInactive(s.uid, days);
  return NextResponse.json({ ok: true, ...res, days });
}
