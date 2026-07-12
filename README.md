# 스마트스토어 클론 — PII 보호형 쇼핑몰 MVP

네이버 스마트스토어형 쇼핑몰의 **동작하는 MVP 스캐폴드**. 차별점은 **실무형 PIPA(개인정보보호법) 개인정보 처리**를 코드 레벨에서 구현한 것.

- **스택**: Next.js 14 (App Router) · Prisma · PostgreSQL · TypeScript
- **범위**: 회원가입/로그인, 상품, 장바구니·주문(배송지 암호화), 배송지 주소록, 1:1 문의, 마이페이지, 판매자 상품관리, 관리자 접근로그 뷰어, 개인정보 열람·파기
- **결제·배송사 연동**은 실제 구현 대신 흐름만 (mock)

### 화면 (App Router 페이지)

| 경로 | 설명 |
|------|------|
| `/` | 스토어프론트 — 상품 목록 · 장바구니 담기 |
| `/signup` · `/login` | 회원가입(항목별 동의) · 로그인 |
| `/cart` · `/checkout` | 장바구니 · 주문서(배송지 암호화 저장) |
| `/mypage` | 주문내역 · 배송지 주소록 · 1:1 문의 · 개인정보 열람/파기 |
| `/seller` | 판매자 상품 등록·삭제 |
| `/admin/users` | 관리자 — 회원 관리(휴면 전환·해제·일괄, 완전 파기, 평문 열람, **제3자 제공 묶기**) |
| `/admin/orders` | 관리자 — 주문 배송 처리(제3자 제공) |
| `/admin/logs` | 관리자 — 개인정보 접근 감사로그 + 해시체인 무결성 검증 |

### 개인정보(PII) 저장 지점 — 모두 AES-256-GCM 암호화

회원 프로필(이름·휴대폰·**주민번호·성별·생년월일**) · **배송지 주소록** · **주문 배송지 스냅샷** · **결제수단(카드번호·계좌번호)** · **1:1 문의 연락처** — 각 지점의 쓰기/읽기는 감사로그(`PiiAccessLog`)로 기록된다.

### 개인정보 생애주기 (수집 → 저장 → 이용 → 제공 → 파기)

| 단계 | 기능 | 경로 |
|------|------|------|
| 수집 | 회원가입(이름·휴대폰·주민번호·성별·생년월일), 배송지·결제수단·문의 등록 | `/signup`, `/mypage`, `/checkout` |
| 저장 | AES-256-GCM 암호화 + 블라인드 인덱스(HMAC) | `src/lib/crypto.ts` |
| 이용 | 마스킹 조회, **프로필 수정(PATCH)**, 관리자 평문 열람(사유), **휴면 전환·해제**(장기 미접속 분리보관) | `/mypage`, `PATCH /api/me`, `/admin/users` |
| 제공 | **제3자 제공(배송사)** + **다건 제공 묶기(배치)** — 제공 대장/배치 + PROVIDE 감사로그, 동의 근거 시 미동의 회원 자동 제외 | `POST /api/orders/[id]/ship`, `POST /api/admin/provisions` |
| 파기 | **항목별 파기**(주민번호 등), 회원 탈퇴 전체 파기, **보관기간 만료 완전 파기(하드 삭제)** | `POST /api/me/erase`, `DELETE /api/me`, `POST /api/admin/users/purge` |

## 개인정보 보호 핵심 (이 프로젝트의 요지)

| 요구 | 구현 위치 |
|------|-----------|
| 저장 암호화 (AES-256-GCM) | [src/lib/crypto.ts](src/lib/crypto.ts) — email/name/phone/rrn/배송지 |
| 암호화 컬럼 동등검색 (블라인드 인덱스) | `blindIndex()` — 평문 복호화 없이 로그인 조회 |
| 필수/선택 동의 분리 | [src/lib/consent.ts](src/lib/consent.ts), 가입 API에서 검증 |
| 고유식별정보(주민번호) 별도 동의·최소수집 | [signup/route.ts](src/app/api/auth/signup/route.ts) |
| 마스킹 기본 노출 | [src/lib/pii.ts](src/lib/pii.ts) |
| 접근 감사로그 (READ/REVEAL/EXPORT/UPDATE/DELETE) + **해시체인 위변조 탐지** | [src/lib/audit.ts](src/lib/audit.ts) + `PiiAccessLog`, 관리자 `/admin/logs`에서 검증 |
| 정보주체 열람권(내보내기) | [me/export/route.ts](src/app/api/me/export/route.ts) |
| 삭제권·파기(익명화 + 보관기간) | `withdrawUser()`, [scripts/purge.mjs](scripts/purge.mjs) |
| 관리자 평문 열람은 사유 필수 | [admin/users/route.ts](src/app/api/admin/users/route.ts) |
| 키 분리 (암호화 키 ≠ 인덱스 키) | [.env.example](.env.example) |
| 보안 헤더 (요청별 nonce CSP·HSTS 등) | [src/middleware.ts](src/middleware.ts) |

## 실행

```bash
npm install

# 1) 개인정보 키 생성 → .env 에 붙여넣기
cp .env.example .env
npm run keygen        # 출력된 3줄을 .env 에 반영, DATABASE_URL 도 설정

# 2) DB 스키마 반영 + 샘플 데이터
npm run db:push
npm run db:seed

# 3) 개발 서버
npm run dev           # http://localhost:3000
```

### 빠른 확인 (curl)

```bash
# 가입 (필수 동의 포함)
curl -c cookies.txt -X POST localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{
  "email":"me@test.com","password":"pass1234","name":"홍길동","phone":"010-1234-5678",
  "consents":{"TERMS":true,"PRIVACY_REQUIRED":true,"MARKETING":false}
}'

curl -b cookies.txt localhost:3000/api/me            # 마스킹된 내 정보
curl -b cookies.txt localhost:3000/api/me/export     # 열람권 — 전체 다운로드
curl -b cookies.txt -X DELETE localhost:3000/api/me  # 파기(탈퇴)
```

## 운영 전 반드시 (스캐폴드 한계)

- 암호화 키는 **KMS/Secret Manager**로 이관, 키 로테이션 정책 수립
- 감사로그 **위·변조 방지**(append-only 스토리지/WORM) 및 별도 보관
- 로그인 **속도제한·이상탐지**, 세션 재발급/만료 정책 강화
- 개인정보 **암호화 알고리즘·접근권한**은 실제 위수탁·내부관리계획에 맞춰 조정
- 자세한 준수 항목: [docs/PIPA-준수-체크리스트.md](docs/PIPA-준수-체크리스트.md)
- 처리방침 초안: [docs/PII-처리방침.md](docs/PII-처리방침.md)
