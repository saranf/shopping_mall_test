import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { bundleProvision } from '@/repositories/adminRepository';

// 제3자 제공 배치 관리.
// - GET: 제공 배치 이력
// - POST: 선택 회원을 하나의 제공 건으로 "묶어" 제공 대장에 적재 + PROVIDE 감사로그
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const batches = await prisma.provisionBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json(batches);
}

const schema = z.object({
  userIds: z.array(z.string()).min(1, '제공할 회원을 선택하세요'),
  recipientOrg: z.string().min(1),
  purpose: z.string().min(1),
  basis: z.enum(['동의', '법령', '계약이행']),
  items: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const res = await bundleProvision(s.uid, parsed.data);
  return NextResponse.json(res, { status: res.batchId ? 201 : 200 });
}
