// 개인정보 마스킹 유틸 — 화면/로그/관리자 기본 노출은 항상 마스킹 상태로.
// 평문은 REVEAL(사유 기록) 또는 본인 EXPORT 경로에서만 복호화한다.

export function maskName(name: string): string {
  if (!name) return name;
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '*'.repeat(email.length);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(local.length - head.length, 1))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return '*'.repeat(d.length);
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 주민등록번호: 생년월일 앞 6자리 + 성별 1자리만, 뒷자리 마스킹 */
export function maskRRN(rrn: string): string {
  const d = rrn.replace(/\D/g, '');
  if (d.length < 7) return '*'.repeat(d.length);
  return `${d.slice(0, 6)}-${d.slice(6, 7)}******`;
}

/** 생년월일: 연도만 노출, 월·일 마스킹 (예: 1990-**-**) */
export function maskBirthDate(birth: string): string {
  const m = birth.match(/^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/);
  if (!m) return '****-**-**';
  return `${m[1]}-**-**`;
}

/** 성별은 식별력이 낮아 그대로 표기하되 라벨로 변환 */
export function labelGender(g: string): string {
  return g === 'M' ? '남성' : g === 'F' ? '여성' : g === 'OTHER' ? '기타' : g;
}

/** 카드번호: 뒤 4자리만 (**** **** **** 1234) */
export function maskCardNumber(card: string): string {
  const d = card.replace(/\D/g, '');
  if (d.length < 4) return '*'.repeat(d.length);
  return `**** **** **** ${d.slice(-4)}`;
}

/** 계좌번호: 뒤 3자리만 노출 */
export function maskAccount(acc: string): string {
  const d = acc.replace(/\D/g, '');
  if (d.length < 3) return '*'.repeat(d.length);
  return `${'*'.repeat(d.length - 3)}${d.slice(-3)}`;
}

export function maskAddress(addr1: string): string {
  // 시/구까지만 노출, 상세주소 마스킹
  const parts = addr1.split(' ');
  if (parts.length <= 2) return parts[0] + ' ***';
  return parts.slice(0, 2).join(' ') + ' ***';
}
