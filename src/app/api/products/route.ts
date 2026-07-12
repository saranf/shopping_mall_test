import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 상품 목록 (공개)
export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json(products);
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  priceKrw: z.number().int().positive(),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().url().optional(),
});

// 상품 등록 (판매자/관리자)
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (s.role !== 'SELLER' && s.role !== 'ADMIN') {
    return NextResponse.json({ error: '판매자 권한이 필요합니다' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const product = await prisma.product.create({ data: { ...parsed.data, sellerId: s.uid } });
  return NextResponse.json(product, { status: 201 });
}

// 상품 삭제 — 본인(판매자) 상품만. 관리자는 전체 삭제 가능.
export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (s.role !== 'SELLER' && s.role !== 'ADMIN') {
    return NextResponse.json({ error: '판매자 권한이 필요합니다' }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

  const where = s.role === 'ADMIN' ? { id } : { id, sellerId: s.uid };
  const res = await prisma.product.deleteMany({ where });
  if (res.count === 0) return NextResponse.json({ error: '상품을 찾을 수 없습니다' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
