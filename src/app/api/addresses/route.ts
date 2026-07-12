import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encrypt, decrypt, encryptNullable } from '@/lib/crypto';
import { maskName, maskPhone, maskAddress } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 배송지 주소록 — 프로필/주문과 별개로 개인정보를 암호화 저장하는 지점.
// 목록은 항상 마스킹 반환(READ 로그), 저장은 암호화(UPDATE 로그).

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const rows = await prisma.address.findMany({ where: { userId: s.uid }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  if (rows.length) {
    await logPiiAccess({ actorId: s.uid, subjectUserId: s.uid, action: 'READ', fields: ['address.recipient', 'address.phone', 'address.addr'] });
  }

  return NextResponse.json(
    rows.map((a) => ({
      id: a.id,
      label: a.label,
      recipient: maskName(decrypt(a.recipientEnc)),
      phone: maskPhone(decrypt(a.phoneEnc)),
      zipcode: a.zipcode,
      addr1: maskAddress(decrypt(a.addr1Enc)),
      addr2: a.addr2Enc ? '***' : null,
      isDefault: a.isDefault,
    })),
  );
}

const schema = z.object({
  label: z.string().optional(),
  recipient: z.string().min(1),
  phone: z.string().min(1),
  zipcode: z.string().min(1),
  addr1: z.string().min(1),
  addr2: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    // 기본 배송지 지정 시 기존 기본 해제 (단일 기본 유지)
    if (d.isDefault) await tx.address.updateMany({ where: { userId: s.uid, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({
      data: {
        userId: s.uid,
        label: d.label ?? null,
        recipientEnc: encrypt(d.recipient),
        phoneEnc: encrypt(d.phone),
        zipcode: d.zipcode,
        addr1Enc: encrypt(d.addr1),
        addr2Enc: encryptNullable(d.addr2),
        isDefault: d.isDefault ?? false,
      },
    });
  });

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: s.uid,
    action: 'UPDATE',
    fields: ['address.recipient', 'address.phone', 'address.addr'],
    reason: '배송지 추가',
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

  // 본인 소유만 삭제 — 소유권을 조건에 넣어 타인 주소 삭제를 원천 차단
  const res = await prisma.address.deleteMany({ where: { id, userId: s.uid } });
  if (res.count === 0) return NextResponse.json({ error: '주소를 찾을 수 없습니다' }, { status: 404 });

  await logPiiAccess({ actorId: s.uid, subjectUserId: s.uid, action: 'DELETE', fields: ['address'], reason: '배송지 삭제' });
  return NextResponse.json({ ok: true });
}
