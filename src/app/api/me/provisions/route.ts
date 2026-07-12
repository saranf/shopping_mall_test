import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 내 개인정보 제3자 제공 내역 조회(PIPA — 제공 현황 열람권).
// 제공 대장은 개인정보 원문을 담지 않으므로(항목명·제공받는 자만) 그대로 노출한다.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const rows = await prisma.provisionLog.findMany({ where: { userId: s.uid }, orderBy: { providedAt: 'desc' } });
  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      recipientOrg: p.recipientOrg,
      items: p.items,
      purpose: p.purpose,
      basis: p.basis,
      providedAt: p.providedAt,
    })),
  );
}
