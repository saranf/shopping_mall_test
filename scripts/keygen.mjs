import crypto from 'node:crypto';

// 개인정보 보호에 필요한 3개 키를 생성한다.
// 암호화 키와 인덱스 키는 반드시 서로 다른 값이어야 한다(키 분리 원칙).
const gen = () => crypto.randomBytes(32).toString('base64');

console.log(`PII_ENCRYPTION_KEY="${gen()}"`);
console.log(`PII_INDEX_KEY="${gen()}"`);
console.log(`SESSION_SECRET="${gen()}"`);
console.error('\n위 3줄을 .env 에 붙여넣으세요. 운영에서는 KMS/Secret Manager 사용을 권장합니다.');
