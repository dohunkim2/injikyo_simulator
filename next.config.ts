import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ["10.5.12.27"],
};

export default nextConfig;
