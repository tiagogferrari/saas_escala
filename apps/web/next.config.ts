import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@escala/design-tokens",
    "@escala/shared",
    "@escala/ui-web",
  ],
};

export default nextConfig;
