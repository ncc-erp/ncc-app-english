import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	outputFileTracingRoot: __dirname,
	reactStrictMode: true,
	eslint: {
		ignoreDuringBuilds: true
	},
	typescript: {
		ignoreBuildErrors: true
	},
	serverExternalPackages: ['mezon-sdk', 'better-sqlite3'],
	env: {
		NEXT_PUBLIC_MEZON_CLAN_INVITE_URL:
			process.env.NEXT_PUBLIC_MEZON_CLAN_INVITE_URL || process.env.MEZON_CLAN_INVITE_URL || 'https://mezon.ai/invite/2099684553655324672'
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**'
			}
		]
	}
};

export default nextConfig;
