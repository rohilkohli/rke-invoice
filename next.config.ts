import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  experimental: {
    // Server actions accept 1 MB by default, less than the picture or PDF an invoice scan sends.
    // The host itself stops a request at about 4.5 MB, so this is as high as is useful.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
