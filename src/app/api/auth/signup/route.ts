import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findByEmail, createUser } from '@/repositories/userRepository';
import { createSession } from '@/lib/auth';
import { validateRequiredConsents } from '@/lib/consent';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, '비밀번호는 8자 이상'),
  name: z.string().min(1),
  phone: z.string().optional(),
  rrn: z.string().regex(/^\d{6}-?\d{7}$/, '주민번호 형식 오류').optional(),
  gender: z.enum(['M', 'F', 'OTHER']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식 오류(YYYY-MM-DD)').optional(),
  consents: z.object({
    TERMS: z.boolean().optional(),
    PRIVACY_REQUIRED: z.boolean().optional(),
    MARKETING: z.boolean().optional(),
    THIRD_PARTY_PROVISION: z.boolean().optional(),
    SENSITIVE_UNIQUE_ID: z.boolean().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  // 필수 동의 검증 (PIPA — 필수/선택 분리, 필수 미동의 시 가입 불가)
  const consentCheck = validateRequiredConsents(data.consents);
  if (!consentCheck.ok) {
    return NextResponse.json({ error: `필수 동의 누락: ${consentCheck.missing.join(', ')}` }, { status: 400 });
  }
  // 주민번호 수집 시 고유식별정보 별도 동의 필수 (PIPA 제24조)
  if (data.rrn && data.consents.SENSITIVE_UNIQUE_ID !== true) {
    return NextResponse.json({ error: '주민등록번호 처리에는 별도 동의가 필요합니다' }, { status: 400 });
  }

  if (await findByEmail(data.email)) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다' }, { status: 409 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const user = await createUser({ ...data, ip });
  await createSession({ uid: user.id, role: user.role });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
