import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, blindIndex, encryptNullable, decryptNullable } from '@/lib/crypto';
import { maskEmail, maskName, maskPhone, maskRRN, maskBirthDate, labelGender } from '@/lib/pii';
import { logPiiAccess } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { CURRENT_POLICY_VERSION, type ConsentInput } from '@/lib/consent';
import { Prisma, type ConsentType, type Role } from '@prisma/client';

// 개인정보 접근을 이 레포지토리 한 곳으로 모은다.
// - 쓰기: 민감 필드를 반드시 암호화 + 블라인드 인덱스 부여
// - 읽기: 기본은 마스킹, 평문은 revealProfile/exportProfile 경로에서만 (감사로그 동반)

export type SignupInput = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  rrn?: string;
  gender?: string; // M | F | OTHER
  birthDate?: string; // YYYY-MM-DD
  role?: Role;
  consents: ConsentInput;
  ip?: string | null;
};

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { emailHash: blindIndex(email) } });
}

export async function createUser(input: SignupInput) {
  const passwordHash = await hashPassword(input.password);

  const consentRows = (Object.keys(input.consents) as ConsentType[])
    .filter((t) => input.consents[t] !== undefined)
    .map((t) => ({
      type: t,
      version: CURRENT_POLICY_VERSION,
      granted: input.consents[t] === true,
      ip: input.ip ?? null,
    }));

  const user = await prisma.user.create({
    data: {
      emailEnc: encrypt(input.email),
      emailHash: blindIndex(input.email),
      passwordHash,
      nameEnc: encrypt(input.name),
      phoneEnc: encryptNullable(input.phone),
      phoneHash: input.phone ? blindIndex(input.phone) : null,
      rrnEnc: encryptNullable(input.rrn),
      genderEnc: encryptNullable(input.gender),
      birthDateEnc: encryptNullable(input.birthDate),
      role: input.role ?? 'CUSTOMER',
      consents: { create: consentRows },
    },
  });

  await logPiiAccess({
    actorId: user.id,
    subjectUserId: user.id,
    action: 'UPDATE',
    fields: [
      'email',
      'name',
      ...(input.phone ? ['phone'] : []),
      ...(input.rrn ? ['rrn'] : []),
      ...(input.gender ? ['gender'] : []),
      ...(input.birthDate ? ['birthDate'] : []),
    ],
    reason: '회원가입',
  });

  return user;
}

/** 마스킹된 프로필 — 화면/관리자 목록 기본값. READ 로그 기록. */
export async function getMaskedProfile(subjectUserId: string, actorId: string) {
  const u = await prisma.user.findUnique({ where: { id: subjectUserId } });
  if (!u) return null;

  await logPiiAccess({ actorId, subjectUserId, action: 'READ', fields: ['email', 'name', 'phone', 'gender', 'birthDate'] });

  return {
    id: u.id,
    email: maskEmail(decrypt(u.emailEnc)),
    name: maskName(decrypt(u.nameEnc)),
    phone: u.phoneEnc ? maskPhone(decrypt(u.phoneEnc)) : null,
    rrn: u.rrnEnc ? maskRRN(decrypt(u.rrnEnc)) : null,
    gender: u.genderEnc ? labelGender(decrypt(u.genderEnc)) : null,
    birthDate: u.birthDateEnc ? maskBirthDate(decrypt(u.birthDateEnc)) : null,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  };
}

/** 평문 열람 — 사유 필수. REVEAL 로그 기록. 관리자 예외조회 등 최소 경로에서만. */
export async function revealProfile(subjectUserId: string, actorId: string, reason: string) {
  if (!reason?.trim()) throw new Error('평문 열람에는 사유가 필요합니다');
  const u = await prisma.user.findUnique({ where: { id: subjectUserId } });
  if (!u) return null;

  await logPiiAccess({
    actorId,
    subjectUserId,
    action: 'REVEAL',
    fields: ['email', 'name', 'phone', 'rrn', 'gender', 'birthDate'],
    reason,
  });

  return {
    id: u.id,
    email: decrypt(u.emailEnc),
    name: decrypt(u.nameEnc),
    phone: decryptNullable(u.phoneEnc),
    rrn: decryptNullable(u.rrnEnc),
    gender: decryptNullable(u.genderEnc),
    birthDate: decryptNullable(u.birthDateEnc),
    role: u.role,
    status: u.status,
  };
}

/** 정보주체 열람권(EXPORT) — 본인 데이터 전체 복호화 내려받기. */
export async function exportOwnData(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { consents: true, addresses: true, paymentMethods: true, provisions: true, orders: { include: { items: true } } },
  });
  if (!u) return null;

  await logPiiAccess({ actorId: userId, subjectUserId: userId, action: 'EXPORT', fields: ['ALL'], reason: '정보주체 열람권 행사' });

  return {
    profile: {
      email: decrypt(u.emailEnc),
      name: decrypt(u.nameEnc),
      phone: decryptNullable(u.phoneEnc),
      rrn: u.rrnEnc ? maskRRN(decrypt(u.rrnEnc)) : null, // 고유식별정보는 열람 시에도 마스킹 노출
      gender: decryptNullable(u.genderEnc),
      birthDate: decryptNullable(u.birthDateEnc),
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    },
    consents: u.consents.map((c) => ({ type: c.type, granted: c.granted, version: c.version, grantedAt: c.grantedAt })),
    addresses: u.addresses.map((a) => ({
      label: a.label,
      recipient: decrypt(a.recipientEnc),
      phone: decrypt(a.phoneEnc),
      zipcode: a.zipcode,
      addr1: decrypt(a.addr1Enc),
      addr2: decryptNullable(a.addr2Enc),
    })),
    paymentMethods: u.paymentMethods.map((p) => ({
      type: p.type,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4, // 전체 카드번호는 열람 시에도 노출하지 않음
      bankName: p.bankName,
    })),
    provisions: u.provisions.map((p) => ({
      recipientOrg: p.recipientOrg,
      items: p.items,
      purpose: p.purpose,
      basis: p.basis,
      providedAt: p.providedAt,
    })),
    orders: u.orders.map((o) => ({ id: o.id, status: o.status, totalKrw: o.totalKrw, createdAt: o.createdAt })),
  };
}

/** 프로필 수정(이용 단계) — 변경된 필드만 재암호화 저장, UPDATE 로그 기록. */
export async function updateProfile(
  userId: string,
  patch: { phone?: string | null; gender?: string | null; birthDate?: string | null },
) {
  const data: Prisma.UserUpdateInput = {};
  const changed: string[] = [];
  if (patch.phone !== undefined) {
    data.phoneEnc = encryptNullable(patch.phone);
    data.phoneHash = patch.phone ? blindIndex(patch.phone) : null;
    changed.push('phone');
  }
  if (patch.gender !== undefined) {
    data.genderEnc = encryptNullable(patch.gender);
    changed.push('gender');
  }
  if (patch.birthDate !== undefined) {
    data.birthDateEnc = encryptNullable(patch.birthDate);
    changed.push('birthDate');
  }
  if (changed.length === 0) return;

  await prisma.user.update({ where: { id: userId }, data });
  await logPiiAccess({ actorId: userId, subjectUserId: userId, action: 'UPDATE', fields: changed, reason: '프로필 수정' });
}

/** 항목별 파기 — 특정 개인정보 항목만 즉시 삭제(예: 주민번호 파기). DELETE 로그 기록. */
export async function eraseProfileField(userId: string, field: 'rrn' | 'gender' | 'birthDate' | 'phone') {
  const data: Prisma.UserUpdateInput = {};
  switch (field) {
    case 'rrn': data.rrnEnc = null; break;
    case 'gender': data.genderEnc = null; break;
    case 'birthDate': data.birthDateEnc = null; break;
    case 'phone': data.phoneEnc = null; data.phoneHash = null; break;
  }
  await prisma.user.update({ where: { id: userId }, data });
  await logPiiAccess({ actorId: userId, subjectUserId: userId, action: 'DELETE', fields: [field], reason: `개인정보 항목 파기(${field})` });
}

/**
 * 파기(회원 탈퇴). PIPA 원칙: 지체 없이 파기하되, 전자상거래법상 보존의무 데이터는
 * 보관기간까지 분리·최소보관. 여기서는 개인 식별정보를 즉시 익명화(암호문 폐기)하고
 * 주문 통계는 보존한다. 실제 완전삭제는 purgeAfter 배치가 수행한다고 가정.
 */
export async function withdrawUser(userId: string) {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5); // 예: 5일 유예

  await prisma.$transaction([
    // 별도 테이블의 개인정보(주소록·결제수단)는 즉시 완전 삭제
    prisma.address.deleteMany({ where: { userId } }),
    prisma.paymentMethod.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: now,
        purgeAfter,
        // 식별정보 즉시 폐기 — 원문 복원 불가 토큰으로 대체.
        // emailHash(블라인드 인덱스)도 함께 폐기해 "이 이메일이 가입했었나" 재식별 차단.
        emailEnc: encrypt(`withdrawn:${userId}`),
        emailHash: blindIndex(`withdrawn:${userId}`),
        nameEnc: encrypt('탈퇴회원'),
        phoneEnc: null,
        phoneHash: null,
        rrnEnc: null,
        genderEnc: null,
        birthDateEnc: null,
      },
    }),
  ]);

  await logPiiAccess({ actorId: userId, subjectUserId: userId, action: 'DELETE', fields: ['ALL'], reason: '회원 탈퇴 — 개인정보 파기' });
}
