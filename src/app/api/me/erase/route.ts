import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { eraseProfileField } from '@/repositories/userRepository';

// 항목별 파기(파기 단계) — 회원 유지한 채 특정 개인정보 항목만 즉시 삭제.
// 예: 본인인증 목적 달성 후 주민등록번호 파기.
const schema = z.object({ field: z.enum(['rrn', 'gender', 'birthDate', 'phone']) });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '파기할 항목을 지정하세요' }, { status: 400 });

  await eraseProfileField(s.uid, parsed.data.field);
  return NextResponse.json({ ok: true, message: `${parsed.data.field} 항목이 파기되었습니다` });
}
