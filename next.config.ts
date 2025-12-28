import type { NextConfig } from "next";

const repoName = "pianote"; // change if your GitHub repo name differs
const isGhPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGhPages ? `/${repoName}` : undefined,
  assetPrefix: isGhPages ? `/${repoName}/` : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
