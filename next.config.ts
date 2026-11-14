import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Helyi hálózati eszközökről (telefon, tablet) is működjön a dev szerver és a hidratálás
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  serverExternalPackages: ["sharp"],
}

export default nextConfig
