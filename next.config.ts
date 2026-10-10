import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "bcryptjs"],
  // CLAUDE.md is hand-written for this project (it points at the bundled Next docs itself).
  agentRules: false,
};

export default nextConfig;
