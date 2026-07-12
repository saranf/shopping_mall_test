/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 보안 헤더는 미들웨어(src/middleware.ts)에서 일괄 부여
};
export default nextConfig;
