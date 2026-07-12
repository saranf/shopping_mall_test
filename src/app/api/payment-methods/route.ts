import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encrypt, encryptNullable, decrypt } from '@/lib/crypto';
import { maskCardNumber, maskAccount } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 결제수단(카드/계좌) — 카드번호·계좌번호(민감/비밀정보)를 암호화 저장.
// 목록은 브랜드+뒤4자리만 노출(READ 로그). 저장은 UPDATE 로그.

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const rows = await prisma.paymentMethod.findMany({ where: { userId: s.uid }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  if (rows.length) {
    await logPiiAccess({ actorId: s.uid, subjectUserId: s.uid, action: 'READ', fields: ['payment.card', 'payment.account'] });
  }

  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      type: p.type,
      cardBrand: p.cardBrand,
      cardMasked: p.cardNumberEnc ? maskCardNumber(decrypt(p.cardNumberEnc)) : null,
      bankName: p.bankName,
      accountMasked: p.accountEnc ? maskAccount(decrypt(p.accountEnc)) : null,
      isDefault: p.isDefault,
    })),
  );
}

const cardSchema = z.object({
  type: z.literal('CARD'),
  cardBrand: z.string().min(1),
  cardNumber: z.string().regex(/^\d{13,16}$/, '카드번호 형식 오류'),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, '유효기간 MM/YY').optional(),
  isDefault: z.boolean().optional(),
});
const bankSchema = z.object({
  type: z.literal('BANK'),
  bankName: z.string().min(1),
  account: z.string().regex(/^\d{6,20}$/, '계좌번호 형식 오류'),
  holder: z.string().min(1),
  isDefault: z.boolean().optional(),
});
const schema = z.discriminatedUnion('type', [cardSchema, bankSchema]);

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.paymentMethod.updateMany({ where: { userId: s.uid, isDefault: true }, data: { isDefault: false } });
    return tx.paymentMethod.create({
      data:
        d.type === 'CARD'
          ? {
              userId: s.uid,
              type: 'CARD',
              cardBrand: d.cardBrand,
              cardLast4: d.cardNumber.slice(-4),
              cardNumberEnc: encrypt(d.cardNumber),
              cardExpiryEnc: encryptNullable(d.cardExpiry),
              isDefault: d.isDefault ?? false,
            }
          : {
              userId: s.uid,
              type: 'BANK',
              bankName: d.bankName,
              accountEnc: encrypt(d.account),
              holderEnc: encrypt(d.holder),
              isDefault: d.isDefault ?? false,
            },
    });
  });

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: s.uid,
    action: 'UPDATE',
    fields: d.type === 'CARD' ? ['payment.card'] : ['payment.account'],
    reason: '결제수단 등록',
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

  const res = await prisma.paymentMethod.deleteMany({ where: { id, userId: s.uid } });
  if (res.count === 0) return NextResponse.json({ error: '결제수단을 찾을 수 없습니다' }, { status: 404 });

  await logPiiAccess({ actorId: s.uid, subjectUserId: s.uid, action: 'DELETE', fields: ['payment'], reason: '결제수단 삭제' });
  return NextResponse.json({ ok: true });
}
