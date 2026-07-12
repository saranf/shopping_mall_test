import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encrypt, decrypt, encryptNullable } from '@/lib/crypto';
import { maskName, maskPhone, maskEmail } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 1:1 문의 — 답변 연락용 이름/연락처/이메일을 암호화 저장(프로필·주소·주문에 이은 PII 지점).
// 목록은 마스킹 반환. 로그인 사용자의 본인 문의만 조회한다.

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const rows = await prisma.inquiry.findMany({
    where: { userId: s.uid },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true } } },
  });
  if (rows.length) {
    await logPiiAccess({ actorId: s.uid, subjectUserId: s.uid, action: 'READ', fields: ['inquiry.name', 'inquiry.phone', 'inquiry.email'] });
  }

  return NextResponse.json(
    rows.map((q) => ({
      id: q.id,
      category: q.category,
      productName: q.product?.name ?? null,
      title: q.title,
      body: q.body,
      name: maskName(decrypt(q.nameEnc)),
      phone: q.phoneEnc ? maskPhone(decrypt(q.phoneEnc)) : null,
      email: q.emailEnc ? maskEmail(decrypt(q.emailEnc)) : null,
      status: q.status,
      answer: q.answer,
      answeredAt: q.answeredAt,
      createdAt: q.createdAt,
    })),
  );
}

const schema = z.object({
  category: z.enum(['PRODUCT', 'DELIVERY', 'REFUND', 'ETC']).default('PRODUCT'),
  productId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  // 상품 문의면 상품 존재 확인 (없으면 일반 문의로 저장)
  const productId = d.productId
    ? (await prisma.product.findUnique({ where: { id: d.productId }, select: { id: true } }))?.id ?? null
    : null;

  const created = await prisma.inquiry.create({
    data: {
      userId: s.uid,
      productId,
      category: d.category,
      title: d.title,
      body: d.body,
      nameEnc: encrypt(d.name),
      phoneEnc: encryptNullable(d.phone),
      emailEnc: encryptNullable(d.email),
    },
  });

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: s.uid,
    action: 'UPDATE',
    fields: ['inquiry.name', ...(d.phone ? ['inquiry.phone'] : []), ...(d.email ? ['inquiry.email'] : [])],
    reason: '1:1 문의 등록',
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
