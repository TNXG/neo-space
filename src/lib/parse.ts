/**
 * Client Hints Parser
 * 专门解析 User-Agent Client Hints API 的轻量级库
 * 不再回退到 User-Agent 字符串解析
 */

// --- Types ---

export interface UABrand {
	brand: string;
	version: string;
}

/**
 * 低熵 Client Hints 数据（无需权限即可获取）
 */
export interface LowEntropyData {
	brands: UABrand[];
	mobile: boolean;
	platform: string;
}

/**
 * 高熵 Client Hints 数据（需要通过 getHighEntropyValues 获取）
 */
export interface HighEntropyData {
	architecture?: string;
	bitness?: string;
	model?: string;
	platformVersion?: string;
	fullVersionList?: UABrand[];
}

/**
 * 完整的 Client Hints 数据
 */
export interface ClientHintsData extends LowEntropyData, HighEntropyData {}

/**
 * 浏览器信息
 */
export interface BrowserInfo {
	name: string;
	version: string;
	major: string;
}

/**
 * 操作系统信息
 */
export interface OSInfo {
	name: string;
	version: string;
}

/**
 * 设备信息
 */
export interface DeviceInfo {
	type: "mobile" | "desktop";
	model?: string;
}

/**
 * CPU 信息
 */
export interface CPUInfo {
	architecture?: string;
	bitness?: string;
}

/**
 * 解析结果
 */
export interface ParseResult {
	browser: BrowserInfo;
	os: OSInfo;
	device: DeviceInfo;
	cpu: CPUInfo;
	supported: boolean;
}

// --- Constants ---

const UNKNOWN = "unknown";

/**
 * 需要过滤的 GREASE 品牌（Google 添加的假品牌用于防止嗅探）
 */
const GREASE_PATTERNS = [
	"Not A;Brand",
	"Not=A?Brand",
	"Not/A)Brand",
	"Not_A Brand",
];

/**
 * 平台名称映射
 */
const PLATFORM_MAP: Record<string, string> = {
	"macOS": "Mac OS",
	"Windows": "Windows",
	"Android": "Android",
	"Linux": "Linux",
	"Chrome OS": "Chrome OS",
	"iOS": "iOS",
};

// --- Helpers ---

/**
 * 检查浏览器是否支持 Client Hints API
 */
export function isClientHintsSupported(): boolean {
	return typeof navigator !== "undefined" && "userAgentData" in navigator;
}

/**
 * 从品牌列表中选择最佳品牌（过滤 GREASE）
 */
function pickBestBrand(brands: UABrand[]): UABrand | null {
	// 过滤掉 GREASE 品牌和 Chromium
	const validBrands = brands.filter(
		b => !GREASE_PATTERNS.some(p => b.brand.includes(p)) && b.brand !== "Chromium",
	);

	if (validBrands.length > 0) {
		return validBrands[0];
	}

	// 如果只有 Chromium，返回它
	const chromium = brands.find(b => b.brand === "Chromium");
	if (chromium) {
		return chromium;
	}

	return brands[0] || null;
}

/**
 * 获取主版本号
 */
function getMajorVersion(version: string): string {
	return version.split(".")[0] || UNKNOWN;
}

/**
 * 映射平台名称
 */
function mapPlatform(platform: string): string {
	return PLATFORM_MAP[platform] || platform;
}

// --- Main API ---

/**
 * 获取低熵 Client Hints 数据（同步，无需权限）
 */
export function getLowEntropyData(): LowEntropyData | null {
	if (!isClientHintsSupported()) {
		return null;
	}

	const uaData = (navigator as any).userAgentData;

	return {
		brands: uaData.brands || [],
		mobile: uaData.mobile ?? false,
		platform: uaData.platform || UNKNOWN,
	};
}

/**
 * 获取高熵 Client Hints 数据（异步，可能需要权限）
 */
export async function getHighEntropyData(): Promise<HighEntropyData | null> {
	if (!isClientHintsSupported()) {
		return null;
	}

	const uaData = (navigator as any).userAgentData;

	if (typeof uaData.getHighEntropyValues !== "function") {
		return null;
	}

	try {
		const hints = await uaData.getHighEntropyValues([
			"architecture",
			"bitness",
			"model",
			"platformVersion",
			"fullVersionList",
		]);

		return {
			architecture: hints.architecture,
			bitness: hints.bitness,
			model: hints.model,
			platformVersion: hints.platformVersion,
			fullVersionList: hints.fullVersionList,
		};
	} catch {
		return null;
	}
}

/**
 * 获取完整的 Client Hints 数据
 */
export async function getClientHintsData(): Promise<ClientHintsData | null> {
	const lowEntropy = getLowEntropyData();
	if (!lowEntropy) {
		return null;
	}

	const highEntropy = await getHighEntropyData();

	return {
		...lowEntropy,
		...highEntropy,
	};
}

/**
 * 解析 Client Hints 数据为结构化结果
 */
export function parse(data: ClientHintsData): ParseResult {
	// 解析浏览器信息
	const brandList = data.fullVersionList || data.brands;
	const brand = pickBestBrand(brandList);

	const browser: BrowserInfo = {
		name: brand?.brand || UNKNOWN,
		version: brand?.version || UNKNOWN,
		major: brand ? getMajorVersion(brand.version) : UNKNOWN,
	};

	// 解析操作系统信息
	const os: OSInfo = {
		name: mapPlatform(data.platform),
		version: data.platformVersion || UNKNOWN,
	};

	// 解析设备信息
	const device: DeviceInfo = {
		type: data.mobile ? "mobile" : "desktop",
		model: data.model,
	};

	// 解析 CPU 信息
	const cpu: CPUInfo = {
		architecture: data.architecture,
		bitness: data.bitness,
	};

	return {
		browser,
		os,
		device,
		cpu,
		supported: true,
	};
}

/**
 * 一键获取并解析 Client Hints（推荐使用）
 */
export async function getClientInfo(): Promise<ParseResult> {
	const data = await getClientHintsData();

	if (!data) {
		return {
			browser: { name: UNKNOWN, version: UNKNOWN, major: UNKNOWN },
			os: { name: UNKNOWN, version: UNKNOWN },
			device: { type: "desktop" },
			cpu: {},
			supported: false,
		};
	}

	return parse(data);
}

/**
 * 快速获取浏览器信息（仅低熵数据）
 */
export function getBrowserInfo(): BrowserInfo {
	const data = getLowEntropyData();

	if (!data) {
		return { name: UNKNOWN, version: UNKNOWN, major: UNKNOWN };
	}

	const brand = pickBestBrand(data.brands);

	return {
		name: brand?.brand || UNKNOWN,
		version: brand?.version || UNKNOWN,
		major: brand ? getMajorVersion(brand.version) : UNKNOWN,
	};
}

/**
 * 快速获取平台信息（仅低熵数据）
 */
export function getPlatformInfo(): { name: string; mobile: boolean } {
	const data = getLowEntropyData();

	if (!data) {
		return { name: UNKNOWN, mobile: false };
	}

	return {
		name: mapPlatform(data.platform),
		mobile: data.mobile,
	};
}

/**
 * 快速检查是否为移动设备
 */
export function isMobile(): boolean {
	const data = getLowEntropyData();
	return data?.mobile ?? false;
}

export default {
	isClientHintsSupported,
	getLowEntropyData,
	getHighEntropyData,
	getClientHintsData,
	parse,
	getClientInfo,
	getBrowserInfo,
	getPlatformInfo,
	isMobile,
};
