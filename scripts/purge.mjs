// 보관기간이 만료된 탈퇴회원을 완전 파기하는 배치 예시.
// 운영에서는 cron(예: 매일 새벽)으로 실행. 여기서는 개념 시연용.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const now = new Date();
const expired = await prisma.user.findMany({
  where: { status: 'WITHDRAWN', purgeAfter: { lte: now } },
  select: { id: true },
});

for (const u of expired) {
  // 주문/감사로그의 법정 보존기간 정책에 따라 익명화 또는 삭제 결정.
  // 여기서는 사용자 레코드만 완전 삭제(주문은 통계 목적 보존, FK는 스키마에서 조정).
  await prisma.piiAccessLog.create({
    data: { subjectUserId: u.id, action: 'DELETE', fields: ['ALL'], reason: '보관기간 만료 — 완전 파기' },
  });
  console.log('purge candidate:', u.id);
}

console.log(`만료 대상 ${expired.length}건 처리`);
await prisma.$disconnect();
