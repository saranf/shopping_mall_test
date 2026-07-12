import type { ConsentType } from '@prisma/client';

// 현재 게시 중인 약관/방침 버전 — 문서 개정 시 올리면 재동의 유도 가능
export const CURRENT_POLICY_VERSION = '2026-07-12';

// 필수 동의 항목 — 회원가입 시 반드시 true
export const REQUIRED_CONSENTS: ConsentType[] = ['TERMS', 'PRIVACY_REQUIRED'];

// 선택 동의 항목 — 미동의해도 가입 가능
export const OPTIONAL_CONSENTS: ConsentType[] = ['MARKETING', 'THIRD_PARTY_PROVISION'];

export type ConsentInput = Partial<Record<ConsentType, boolean>>;

/** 필수 동의가 모두 충족됐는지 검증 */
export function validateRequiredConsents(input: ConsentInput): { ok: boolean; missing: ConsentType[] } {
  const missing = REQUIRED_CONSENTS.filter((c) => input[c] !== true);
  return { ok: missing.length === 0, missing };
}
