import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encrypt, encryptNullable } from '@/lib/crypto';
import { logPiiAccess } from '@/lib/audit';

// 내 주문 목록 (배송지 개인정보는 반환하지 않음 — 필요 시 상세 API에서 마스킹)
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  const orders = await prisma.order.findMany({
    where: { userId: s.uid },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, totalKrw: true, createdAt: true, items: true },
  });
  return NextResponse.json(orders);
}

const schema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).min(1),
  shipping: z.object({
    recipient: z.string().min(1),
    phone: z.string().min(1),
    zipcode: z.string().min(1),
    addr1: z.string().min(1),
    addr2: z.string().optional(),
  }),
});

// 주문 생성 — 배송지 개인정보를 주문 시점 스냅샷으로 암호화 저장
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { items, shipping } = parsed.data;

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  // 상품 존재·재고 검증 — 사용자 입력 오류이므로 400으로 응답
  let total = 0;
  const orderItems: { productId: string; qty: number; priceKrw: number }[] = [];
  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p) return NextResponse.json({ error: `상품을 찾을 수 없습니다: ${i.productId}` }, { status: 400 });
    if (p.stock < i.qty) return NextResponse.json({ error: `재고 부족: ${p.name}` }, { status: 409 });
    total += p.priceKrw * i.qty;
    orderItems.push({ productId: p.id, qty: i.qty, priceKrw: p.priceKrw });
  }

  // 동시성: 재고 차감을 조건부 updateMany로 수행해 초과판매 방지
  const order = await prisma.$transaction(async (tx) => {
    for (const i of items) {
      const res = await tx.product.updateMany({
        where: { id: i.productId, stock: { gte: i.qty } },
        data: { stock: { decrement: i.qty } },
      });
      if (res.count === 0) throw new Error(`OUT_OF_STOCK:${i.productId}`);
    }
    return tx.order.create({
      data: {
        userId: s.uid,
        totalKrw: total,
        recipientEnc: encrypt(shipping.recipient),
        phoneEnc: encrypt(shipping.phone),
        zipcode: shipping.zipcode,
        addr1Enc: encrypt(shipping.addr1),
        addr2Enc: encryptNullable(shipping.addr2),
        items: { create: orderItems },
      },
    });
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message.startsWith('OUT_OF_STOCK')) return null;
    throw e;
  });

  if (!order) return NextResponse.json({ error: '재고가 부족하여 주문이 취소되었습니다' }, { status: 409 });

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: s.uid,
    action: 'UPDATE',
    fields: ['shipping.recipient', 'shipping.phone', 'shipping.addr'],
    reason: '주문 배송지 저장',
  });

  return NextResponse.json({ id: order.id, totalKrw: order.totalKrw }, { status: 201 });
}
