import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { maskName, maskAddress } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 관리자 주문 목록 — 배송 처리(제3자 제공) 대상. 배송지는 마스킹 노출(READ 로그).
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, userId: true, status: true, totalKrw: true, createdAt: true, recipientEnc: true, addr1Enc: true },
  });
  if (orders.length) {
    await logPiiAccess({ actorId: s.uid, subjectUserId: null, action: 'READ', fields: ['order.recipient', 'order.addr'], reason: '관리자 주문 목록' });
  }

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalKrw: o.totalKrw,
      createdAt: o.createdAt,
      recipient: maskName(decrypt(o.recipientEnc)),
      addr1: maskAddress(decrypt(o.addr1Enc)),
    })),
  );
}
