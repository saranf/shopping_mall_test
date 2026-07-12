import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { prisma } from './prisma';
import type { PiiAction } from '@prisma/client';

type LogInput = {
  actorId?: string | null; // 접근을 수행한 주체 (본인/관리자/시스템)
  subjectUserId?: string | null; // 개인정보 정보주체
  action: PiiAction;
  fields: string[]; // 접근한 필드
  reason?: string; // REVEAL/EXPORT 시 필수
};

// 해시체인 대상 내용을 결정적으로 직렬화한다(키 순서 고정, null 표기 통일).
// prevHash와 이 문자열을 이어 SHA256 하면, 한 행만 바꿔도 이후 모든 hash가 어긋난다.
function canonical(fields: {
  prevHash: string | null;
  actorId: string | null;
  subjectUserId: string | null;
  action: PiiAction;
  fieldsCsv: string;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  at: Date;
}): string {
  return JSON.stringify({
    prevHash: fields.prevHash,
    actorId: fields.actorId,
    subjectUserId: fields.subjectUserId,
    action: fields.action,
    fields: fields.fieldsCsv,
    reason: fields.reason,
    ip: fields.ip,
    userAgent: fields.userAgent,
    at: fields.at.toISOString(),
  });
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * 개인정보 접근 감사로그 기록 (해시체인).
 * 직전 레코드의 hash를 prevHash로 이어붙여 위·변조 탐지 체인을 구성한다.
 * 체인 무결성을 위해 "마지막 로그 조회 → 생성"을 트랜잭션으로 직렬화한다.
 * 감사로그 누락은 심각하므로 예외를 삼키지 않는다.
 */
export async function logPiiAccess(i: LogInput): Promise<void> {
  // 요청 컨텍스트 밖(시드/배치)에서는 헤더가 없으므로 안전하게 생략
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    userAgent = h.get('user-agent') ?? null;
  } catch {
    /* non-request context */
  }

  const at = new Date();
  const fieldsCsv = i.fields.join(',');

  await prisma.$transaction(async (tx) => {
    const prev = await tx.piiAccessLog.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
    const prevHash = prev?.hash ?? null;
    const hash = sha256(
      canonical({
        prevHash,
        actorId: i.actorId ?? null,
        subjectUserId: i.subjectUserId ?? null,
        action: i.action,
        fieldsCsv,
        reason: i.reason ?? null,
        ip,
        userAgent,
        at,
      }),
    );

    await tx.piiAccessLog.create({
      data: {
        actorId: i.actorId ?? null,
        subjectUserId: i.subjectUserId ?? null,
        action: i.action,
        fields: fieldsCsv,
        reason: i.reason ?? null,
        ip,
        userAgent,
        at,
        prevHash,
        hash,
      },
    });
  });
}

/**
 * 감사로그 체인 무결성 검증 — seq 순서대로 각 레코드의 hash를 재계산해
 * 저장된 hash·prevHash 연결이 일관적인지 확인한다. 관리자 증적 페이지에서 사용.
 */
export async function verifyAuditChain(): Promise<{ ok: boolean; brokenAtSeq: number | null; total: number }> {
  const logs = await prisma.piiAccessLog.findMany({ orderBy: { seq: 'asc' } });
  let prevHash: string | null = null;
  for (const l of logs) {
    const expected = sha256(
      canonical({
        prevHash,
        actorId: l.actorId,
        subjectUserId: l.subjectUserId,
        action: l.action,
        fieldsCsv: l.fields,
        reason: l.reason,
        ip: l.ip,
        userAgent: l.userAgent,
        at: l.at,
      }),
    );
    if (l.prevHash !== prevHash || l.hash !== expected) {
      return { ok: false, brokenAtSeq: l.seq, total: logs.length };
    }
    prevHash = l.hash;
  }
  return { ok: true, brokenAtSeq: null, total: logs.length };
}
