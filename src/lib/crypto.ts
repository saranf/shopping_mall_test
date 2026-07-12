import crypto from 'node:crypto';

// 개인정보 컬럼 암호화 유틸.
// - 저장: AES-256-GCM (기밀성 + 무결성 태그). 컬럼당 랜덤 IV.
// - 검색: 블라인드 인덱스(HMAC-SHA256) — 평문을 복호화하지 않고도 동등검색 가능.
//   암호화 키와 인덱스 키는 반드시 분리한다(한쪽 유출이 다른 쪽으로 번지지 않도록).

const ALGO = 'aes-256-gcm';

function loadKey(envName: string): Buffer {
  const raw = process.env[envName];
  if (!raw) throw new Error(`${envName} 환경변수가 없습니다. \`npm run keygen\` 참고`);
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error(`${envName} 는 base64 인코딩된 32바이트여야 합니다`);
  return key;
}

// 부팅 후 최초 사용 시 1회 로드 (환경변수 미설정을 조기에 발견)
let _encKey: Buffer | null = null;
let _idxKey: Buffer | null = null;
const encKey = () => (_encKey ??= loadKey('PII_ENCRYPTION_KEY'));
const idxKey = () => (_idxKey ??= loadKey('PII_INDEX_KEY'));

/** 평문 → "iv:tag:ciphertext" (모두 base64). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** "iv:tag:ciphertext" → 평문. 위변조 시 예외. */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('암호문 형식 오류');
  const decipher = crypto.createDecipheriv(ALGO, encKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** 암호화 컬럼 동등검색용 결정적 인덱스. 정규화 후 HMAC. */
export function blindIndex(value: string): string {
  return crypto
    .createHmac('sha256', idxKey())
    .update(value.trim().toLowerCase())
    .digest('hex');
}

/** null/undefined 안전 래퍼 */
export const encryptNullable = (v?: string | null) => (v == null || v === '' ? null : encrypt(v));
export const decryptNullable = (v?: string | null) => (v == null ? null : decrypt(v));
