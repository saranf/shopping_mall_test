import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { verifyAuditChain } from '@/lib/audit';

// 관리자 개인정보 접근 감사로그 뷰어 + 체인 무결성 검증(PIPA 제29조 증적).
// 로그 자체는 개인정보 원문을 담지 않으므로(필드명/행위/사유만) 그대로 노출한다.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  const take = Math.min(Number(new URL(req.url).searchParams.get('take') ?? 100), 500);

  const [logs, integrity] = await Promise.all([
    prisma.piiAccessLog.findMany({ orderBy: { seq: 'desc' }, take }),
    verifyAuditChain(),
  ]);

  return NextResponse.json({
    integrity, // { ok, brokenAtSeq, total }
    logs: logs.map((l) => ({
      seq: l.seq,
      action: l.action,
      actorId: l.actorId,
      subjectUserId: l.subjectUserId,
      fields: l.fields,
      reason: l.reason,
      ip: l.ip,
      at: l.at,
      hash: l.hash.slice(0, 12), // 지문만 표시
    })),
  });
}
