import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const COOKIE = 'ss_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export type Session = { uid: string; role: string };

export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT(s)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: payload.uid as string, role: payload.role as string };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().set(COOKIE, '', { maxAge: 0, path: '/' });
}

/** 인증 필수 헬퍼 — 미인증 시 예외 */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, '로그인이 필요합니다');
  return s;
}

/** 관리자 권한 필수 */
export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== 'ADMIN') throw new HttpError(403, '권한이 없습니다');
  return s;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
