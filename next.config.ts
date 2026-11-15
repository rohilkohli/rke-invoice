import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // The server reads the PDF font from public/fonts when it makes a PDF, which the host would
  // not otherwise copy into the deployed function (see lib/pdfFonts.ts).
  outputFileTracingIncludes: {
    "/*": ["./public/fonts/Arimo-Regular.ttf", "./public/fonts/Arimo-Italic.ttf"],
  },
  // Tracing that folder also picks up the other font files in it, which nothing reads.
  outputFileTracingExcludes: {
    "/*": ["./public/fonts/DejaVu*", "./public/fonts/Noto*", "./public/fonts/Roboto*"],
  },
  experimental: {
    // Server actions accept 1 MB by default, less than the picture or PDF an invoice scan sends.
    // The host itself stops a request at about 4.5 MB, so this is as high as is useful.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
