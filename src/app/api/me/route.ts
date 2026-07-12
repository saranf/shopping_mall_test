import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, clearSession } from '@/lib/auth';
import { getMaskedProfile, withdrawUser, updateProfile } from '@/repositories/userRepository';

// 내 정보 조회 — 항상 마스킹 상태로 반환
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const profile = await getMaskedProfile(s.uid, s.uid);
  if (!profile) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
  return NextResponse.json(profile);
}

const patchSchema = z.object({
  phone: z.string().min(1).nullable().optional(),
  gender: z.enum(['M', 'F', 'OTHER']).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// 내 정보 수정(이용 단계) — 변경 항목만 재암호화 저장
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '입력 오류' }, { status: 400 });

  await updateProfile(s.uid, parsed.data);
  const profile = await getMaskedProfile(s.uid, s.uid);
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
