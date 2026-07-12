import { prisma } from '@/lib/prisma';
import AddToCart from '@/components/AddToCart';

// 상품 목록 스토어프론트 (서버 컴포넌트) — 개인정보 미노출
export default async function StorePage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' }, take: 24 }).catch(() => []);

  return (
    <main>
      <h1 className="h1">전체 상품</h1>
      <p className="sub">
        실무형 PIPA 개인정보 보호가 적용된 쇼핑몰 MVP · 회원 개인정보는 암호화·마스킹·접근로그로 관리됩니다.
      </p>

      {products.length === 0 ? (
        <div className="panel">
          아직 상품이 없습니다. <code>npm run db:seed</code> 로 샘플을 넣어보세요.
        </div>
      ) : (
        <ul className="grid">
          {products.map((p) => (
            <li key={p.id} className="card">
              <div className="thumb">🛒</div>
              <div className="name">{p.name}</div>
              <div className="desc">{p.description}</div>
              <div className="price">{p.priceKrw.toLocaleString()}원</div>
              <div className={`stock ${p.stock > 0 ? 'in' : 'out'}`}>
                {p.stock > 0 ? `재고 ${p.stock}개` : '품절'}
              </div>
              <AddToCart productId={p.id} name={p.name} priceKrw={p.priceKrw} disabled={p.stock <= 0} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
