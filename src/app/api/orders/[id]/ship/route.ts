import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logPiiAccess } from '@/lib/audit';

// 배송 처리 = 제3자(택배사) 제공(PIPA 제17조). 판매자/관리자만.
// 주문 배송지(이름·연락처·주소)를 택배사에 제공한 사실을 제공 대장에 기록한다.
// 실제 전송은 하지 않음(테스트용) — 제공 사실·항목·근거만 남긴다.
const schema = z.object({ carrier: z.string().min(1).default('CJ대한통운') });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (s.role !== 'SELLER' && s.role !== 'ADMIN') {
    return NextResponse.json({ error: '판매자 권한이 필요합니다' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const carrier = parsed.success ? parsed.data.carrier : 'CJ대한통운';

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true, userId: true, status: true } });
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
  if (order.status === 'SHIPPED' || order.status === 'DONE') {
    return NextResponse.json({ error: '이미 배송 처리된 주문입니다' }, { status: 409 });
  }

  // 제공 근거: 정보주체가 제3자 제공에 동의했으면 '동의', 아니면 배송 계약이행
  const consent = await prisma.consentRecord.findFirst({
    where: { userId: order.userId, type: 'THIRD_PARTY_PROVISION', granted: true, revokedAt: null },
  });
  const basis = consent ? '정보주체 동의' : '계약이행(배송)';

  await prisma.$transaction([
    prisma.provisionLog.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        recipientOrg: carrier,
        items: '이름,연락처,주소',
        purpose: '상품 배송',
        basis,
      },
    }),
    prisma.order.update({ where: { id: order.id }, data: { status: 'SHIPPED' } }),
  ]);

  await logPiiAccess({
    actorId: s.uid,
    subjectUserId: order.userId,
    action: 'PROVIDE',
    fields: ['order.recipient', 'order.phone', 'order.addr'],
    reason: `제3자 제공 — ${carrier} 배송(${basis})`,
  });

  return NextResponse.json({ ok: true, status: 'SHIPPED', carrier, basis });
}
