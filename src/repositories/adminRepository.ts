import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { maskName, maskPhone } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';

// 관리자 전용 개인정보 처리 — 휴면 전환/해제, 일괄 파기, 제3자 제공 묶기.
// 모든 경로는 감사로그를 남기고, 노출은 마스킹을 기본으로 한다.

/** 회원 상태 변경 (ACTIVE|DORMANT). 휴면 전환 시 dormantAt 기록, 해제 시 해제. */
export async function setUserStatus(actorId: string, userId: string, status: 'ACTIVE' | 'DORMANT') {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!u) return null;
  if (u.status === 'WITHDRAWN') throw new Error('탈퇴 회원은 상태를 변경할 수 없습니다');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status, dormantAt: status === 'DORMANT' ? new Date() : null },
    select: { id: true, status: true },
  });
  await logPiiAccess({
    actorId,
    subjectUserId: userId,
    action: 'UPDATE',
    fields: ['status'],
    reason: status === 'DORMANT' ? '휴면 전환(장기 미접속 분리보관)' : '휴면 해제',
  });
  return updated;
}

/**
 * 장기 미접속 회원 일괄 휴면 전환.
 * 마지막 접속(없으면 가입일)이 기준일 이전인 ACTIVE 회원을 DORMANT로 전환한다.
 * (개인정보 유효기간제 — 미이용 개인정보 분리보관)
 */
export async function markDormantInactive(actorId: string, days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const targets = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: 'CUSTOMER',
      OR: [{ lastLoginAt: { lt: cutoff } }, { lastLoginAt: null, createdAt: { lt: cutoff } }],
    },
    select: { id: true },
  });
  if (targets.length === 0) return { count: 0 };

  const ids = targets.map((t) => t.id);
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: 'DORMANT', dormantAt: new Date() } });
  await logPiiAccess({
    actorId,
    subjectUserId: null,
    action: 'UPDATE',
    fields: ['status'],
    reason: `일괄 휴면 전환 ${ids.length}건 (미접속 ${days}일 초과)`,
  });
  return { count: ids.length };
}

/**
 * 보관기간이 만료된 탈퇴 회원 완전 파기(하드 삭제).
 * withdrawUser에서 식별정보는 이미 익명화했고, purgeAfter 도래분을 여기서 물리 삭제한다.
 */
export async function purgeExpired(actorId: string) {
  const now = new Date();
  const targets = await prisma.user.findMany({
    where: { status: 'WITHDRAWN', purgeAfter: { lte: now } },
    select: { id: true },
  });
  if (targets.length === 0) return { count: 0 };

  const ids = targets.map((t) => t.id);
  // 감사로그는 파기 전에 남긴다(삭제 후에는 subject FK가 사라짐)
  await logPiiAccess({
    actorId,
    subjectUserId: null,
    action: 'DELETE',
    fields: ['ALL'],
    reason: `보관기간 만료 완전 파기 ${ids.length}건`,
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return { count: ids.length };
}

export type BundleInput = {
  userIds: string[];
  recipientOrg: string;
  purpose: string;
  basis: '동의' | '법령' | '계약이행';
  items: string[]; // 예: ['이름','연락처']
};

/**
 * 제3자 제공 "정보 묶기" — 선택 회원들을 하나의 제공 배치로 묶어 제공 대장에 적재.
 * basis='동의'인 경우 마케팅/제3자 제공 동의가 있는 회원만 포함(동의 없는 회원은 제외).
 * 반환값에 실제 묶인 회원의 마스킹 요약을 담아 제공 명세서로 확인할 수 있게 한다.
 */
export async function bundleProvision(actorId: string, input: BundleInput) {
  const users = await prisma.user.findMany({
    where: { id: { in: input.userIds }, status: { not: 'WITHDRAWN' } },
    include: { consents: true },
  });

  // 동의 근거일 때 제3자 제공 동의 없는 회원 제외
  const included = users.filter((u) => {
    if (input.basis !== '동의') return true;
    return u.consents.some((c) => c.type === 'THIRD_PARTY_PROVISION' && c.granted && !c.revokedAt);
  });
  const excludedCount = users.length - included.length;
  if (included.length === 0) {
    return { batchId: null, count: 0, excludedCount, rows: [] as { id: string; name: string; phone: string | null }[] };
  }

  const itemsCsv = input.items.join(',');
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.provisionBatch.create({
      data: {
        recipientOrg: input.recipientOrg,
        purpose: input.purpose,
        basis: input.basis,
        items: itemsCsv,
        createdBy: actorId,
        count: included.length,
      },
    });
    await tx.provisionLog.createMany({
      data: included.map((u) => ({
        userId: u.id,
        batchId: b.id,
        recipientOrg: input.recipientOrg,
        items: itemsCsv,
        purpose: input.purpose,
        basis: input.basis,
      })),
    });
    return b;
  });

  // 제공 사실을 회원별 감사로그로 기록 (누가 누구 정보를 언제 제공했는지)
  for (const u of included) {
    await logPiiAccess({
      actorId,
      subjectUserId: u.id,
      action: 'PROVIDE',
      fields: input.items,
      reason: `제3자 제공(${input.recipientOrg}) — 배치 ${batch.id} · 근거 ${input.basis}`,
    });
  }

  const rows = included.map((u) => ({
    id: u.id,
    name: maskName(decrypt(u.nameEnc)),
    phone: u.phoneEnc ? maskPhone(decrypt(u.phoneEnc)) : null,
  }));

  return { batchId: batch.id, count: included.length, excludedCount, rows };
}
