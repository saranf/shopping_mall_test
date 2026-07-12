import { PrismaClient } from '@prisma/client';
import { createUser } from '../src/repositories/userRepository';
import { prisma as _shared } from '../src/lib/prisma';
import { encrypt, encryptNullable } from '../src/lib/crypto';

const prisma = _shared as PrismaClient;

async function main() {
  // 관리자 계정
  const admin = await createUser({
    email: 'admin@example.com',
    password: 'admin1234',
    name: '관리자',
    phone: '010-0000-0000',
    role: 'ADMIN',
    consents: { TERMS: true, PRIVACY_REQUIRED: true },
  });

  // 판매자 + 샘플 고객
  const seller = await createUser({
    email: 'seller@example.com',
    password: 'seller1234',
    name: '김판매',
    phone: '010-1111-2222',
    role: 'SELLER',
    consents: { TERMS: true, PRIVACY_REQUIRED: true, MARKETING: true },
  });

  const customer = await createUser({
    email: 'customer@example.com',
    password: 'customer1234',
    name: '이고객',
    phone: '010-3333-4444',
    consents: { TERMS: true, PRIVACY_REQUIRED: true, MARKETING: false },
  });

  // 샘플 상품
  const [coffee, buds] = await Promise.all([
    prisma.product.create({ data: { name: '유기농 원두 1kg', description: '갓 볶은 스페셜티 원두', priceKrw: 24000, stock: 50, sellerId: seller.id } }),
    prisma.product.create({ data: { name: '무선 이어버드', description: '노이즈 캔슬링', priceKrw: 89000, stock: 20, sellerId: seller.id } }),
    prisma.product.create({ data: { name: '천연 수제비누 세트', description: '민감성 피부용', priceKrw: 15000, stock: 100, sellerId: seller.id } }),
  ]);

  // --- 개인정보 저장 지점 데모: 주소록 + 주문 배송지 스냅샷 + 1:1 문의 (모두 암호화) ---
  await prisma.address.create({
    data: {
      userId: customer.id,
      label: '집',
      recipientEnc: encrypt('이고객'),
      phoneEnc: encrypt('010-3333-4444'),
      zipcode: '06236',
      addr1Enc: encrypt('서울특별시 강남구 테헤란로 123'),
      addr2Enc: encryptNullable('4층 402호'),
      isDefault: true,
    },
  });

  await prisma.order.create({
    data: {
      userId: customer.id,
      status: 'PAID',
      totalKrw: coffee.priceKrw * 2,
      recipientEnc: encrypt('이고객'),
      phoneEnc: encrypt('010-3333-4444'),
      zipcode: '06236',
      addr1Enc: encrypt('서울특별시 강남구 테헤란로 123'),
      addr2Enc: encryptNullable('4층 402호'),
      items: { create: [{ productId: coffee.id, qty: 2, priceKrw: coffee.priceKrw }] },
    },
  });

  await prisma.inquiry.create({
    data: {
      userId: customer.id,
      productId: buds.id,
      category: 'PRODUCT',
      title: '배송 언제 되나요?',
      body: '주문한 이어버드 배송 예정일이 궁금합니다.',
      nameEnc: encrypt('이고객'),
      phoneEnc: encryptNullable('010-3333-4444'),
      emailEnc: encryptNullable('customer@example.com'),
      status: 'OPEN',
    },
  });

  console.log('✅ 시드 완료. 로그인: admin@example.com / admin1234, customer@example.com / customer1234');
  console.log('   관리자 id:', admin.id);
  console.log('   개인정보 저장 지점: 회원 프로필 · 주소록 · 주문 배송지 · 1:1 문의 (모두 AES-256-GCM 암호화)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
