import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@extractus/article-extractor", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
