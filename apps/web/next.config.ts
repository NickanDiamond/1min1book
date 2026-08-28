import type { NextConfig } from "next";

// The Spring Boot API this frontend talks to. Locally it's the Spring Boot
// dev server on 8080; in a real deploy this becomes an env var pointing at
// wherever the API is hosted. Using a same-origin rewrite (rather than
// fetching http://localhost:8080 directly from the browser) means the
// frontend never needs to deal with CORS -- Next.js's own server proxies
// the request server-side.
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
