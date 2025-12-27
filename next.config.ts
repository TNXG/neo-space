import type { NextConfig } from "next";
import process from "node:process";

const nextConfig: NextConfig = {
	reactCompiler: true,
	output: "standalone",
	async rewrites() {
		const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
		return [
			{
				source: "/api/:path*",
				destination: `${apiUrl}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
