import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { maskName, maskPhone, maskAddress } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 주문 상세 — 본인 주문만. 배송지 개인정보는 마스킹 상태로 반환(READ 로그).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: { id: params.id, userId: s.uid },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: s.uid,
    action: 'READ',
    fields: ['order.recipient', 'order.phone', 'order.addr'],
  });

  return NextResponse.json({
    id: order.id,
    status: order.status,
    totalKrw: order.totalKrw,
    createdAt: order.createdAt,
    items: order.items.map((it) => ({ name: it.product.name, qty: it.qty, priceKrw: it.priceKrw })),
    shipping: {
      recipient: maskName(decrypt(order.recipientEnc)),
      phone: maskPhone(decrypt(order.phoneEnc)),
      zipcode: order.zipcode,
      addr1: maskAddress(decrypt(order.addr1Enc)),
      addr2: order.addr2Enc ? '***' : null,
    },
  });
}
