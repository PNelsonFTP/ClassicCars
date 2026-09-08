import type { NextConfig } from "next";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
};
export default config;
