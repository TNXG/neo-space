/**
 * Client Hints Parser
 * 解析 User-Agent Client Hints API，不支持时回退到 UA 字符串解析
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
export interface ClientHintsData extends LowEntropyData, HighEntropyData { }

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

/**
 * 用于存储到数据库的 UA 信息（序列化后的 JSON 对象）
 */
export interface UAInfo {
	browser: string;
	browserVersion: string;
	os: string;
	osVersion: string;
	device: "mobile" | "desktop";
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

// --- UA String Fallback Parser ---

/**
 * 从 User-Agent 字符串解析浏览器信息（回退方案）
 */
function parseUABrowser(ua: string): BrowserInfo {
	const browsers: Array<{ name: string; regex: RegExp }> = [
		{ name: "Edge", regex: /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/ },
		{ name: "Firefox", regex: /Firefox\/(\d+(?:\.\d+)*)/ },
		{ name: "Safari", regex: /Version\/(\d+(?:\.\d+)*)\s+Safari/ },
		{ name: "Opera", regex: /(?:OPR|Opera)\/(\d+(?:\.\d+)*)/ },
		{ name: "Chrome", regex: /Chrome\/(\d+(?:\.\d+)*)/ },
		{ name: "IE", regex: /(?:MSIE |rv:)(\d+(?:\.\d+)*)/ },
	];

	for (const { name, regex } of browsers) {
		const match = ua.match(regex);
		if (match) {
			const version = match[1] || UNKNOWN;
			return { name, version, major: getMajorVersion(version) };
		}
	}

	return { name: UNKNOWN, version: UNKNOWN, major: UNKNOWN };
}

/**
 * 从 User-Agent 字符串解析操作系统信息（回退方案）
 */
function parseUAOS(ua: string): OSInfo {
	// Windows 版本映射
	const windowsVersions: Record<string, string> = {
		"10.0": "10/11",
		"6.3": "8.1",
		"6.2": "8",
		"6.1": "7",
		"6.0": "Vista",
		"5.1": "XP",
	};

	// Windows
	const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
	if (winMatch) {
		const ntVersion = winMatch[1];
		const version = windowsVersions[ntVersion] || ntVersion;
		return { name: "Windows", version };
	}

	// macOS
	const macMatch = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
	if (macMatch) {
		const version = macMatch[1].replace(/_/g, ".");
		return { name: "Mac OS", version };
	}

	// iOS
	const iosMatch = ua.match(/(?:iPhone|iPad|iPod).*OS (\d+[._]\d+(?:[._]\d+)?)/);
	if (iosMatch) {
		const version = iosMatch[1].replace(/_/g, ".");
		return { name: "iOS", version };
	}

	// Android
	const androidMatch = ua.match(/Android (\d+(?:\.\d+)*)/);
	if (androidMatch) {
		return { name: "Android", version: androidMatch[1] };
	}

	// Linux
	if (/Linux/.test(ua)) {
		return { name: "Linux", version: UNKNOWN };
	}

	return { name: UNKNOWN, version: UNKNOWN };
}

/**
 * 从 User-Agent 字符串解析设备类型（回退方案）
 */
function parseUADevice(ua: string): DeviceInfo {
	const mobileKeywords = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
	return {
		type: mobileKeywords.test(ua) ? "mobile" : "desktop",
	};
}

/**
 * 从 User-Agent 字符串解析完整信息（回退方案）
 */
export function parseUA(ua: string): ParseResult {
	return {
		browser: parseUABrowser(ua),
		os: parseUAOS(ua),
		device: parseUADevice(ua),
		cpu: {},
		supported: false,
	};
}

// --- Serialization for Database ---

/**
 * 映射 Windows platformVersion 到友好的版本名
 */
const mapWindowsVersion = (platformVersion: string): string => {
	// Windows platformVersion 格式：major.minor.build
	const major = platformVersion.split(".")[0];

	// Windows 11: 内核版本 >= 10.0.22000
	// Windows 10: 内核版本 >= 10.0.10240
	if (major === "15" || major === "14" || major === "13") {
		// Windows 11 (NT 10.0, build >= 22000)
		return "11";
	}
	if (major === "10" || major === "11" || major === "12") {
		// Windows 10 (NT 10.0, build < 22000)
		return "10";
	}
	if (major === "6") {
		return "8.1";
	}
	if (major === "5") {
		return "8";
	}

	return platformVersion;
};

/**
 * 格式化浏览器版本号（保留主版本）
 */
const formatBrowserVersion = (version: string): string => {
	if (version === UNKNOWN) {
		return UNKNOWN;
	}

	// 提取主版本号（第一个数字）
	const major = version.split(".")[0];
	return major || version;
};

/**
 * 映射 macOS 版本号到代号 (支持 2025 年最新的 macOS 26 Tahoe)
 */
const mapMacOSVersion = (version: string): string => {
	const parts = version.split(".");
	const major = Number.parseInt(parts[0]);
	const minor = parts.length > 1 ? Number.parseInt(parts[1]) : 0;

	// 1. macOS 26 及以后 (2025年开始的统一版本号命名)
	if (major >= 26) {
		const unifiedMap: Record<number, string> = {
			26: "Tahoe", // macOS 26 Tahoe (2025)
		};
		return unifiedMap[major] || `macOS ${major}`;
	}

	if (major >= 11) {
		const modernMap: Record<number, string> = {
			15: "Sequoia", // (2024)
			14: "Sonoma", // (2023)
			13: "Ventura", // (2022)
			12: "Monterey", // (2021)
			11: "Big Sur", // (2020)
		};
		return modernMap[major] || `macOS ${major}`;
	}

	if (major === 10) {
		const osXMap: Record<number, string> = {
			15: "Catalina",
			14: "Mojave",
			13: "High Sierra",
			12: "Sierra",
			11: "El Capitan",
			10: "Yosemite",
			9: "Mavericks",
			8: "Mountain Lion",
			7: "Lion",
			6: "Snow Leopard",
			5: "Leopard",
			4: "Tiger",
			3: "Panther",
			2: "Jaguar",
			1: "Puma",
			0: "Cheetah",
		};
		return osXMap[minor] || version;
	}

	return version;
};

/**
 * 格式化操作系统版本号
 */
function formatOSVersion(osName: string, version: string): string {
	if (version === UNKNOWN) {
		return UNKNOWN;
	}

	// Windows 特殊处理
	if (osName === "Windows") {
		return mapWindowsVersion(version);
	}

	// macOS 版本号映射到代号
	if (osName === "Mac OS") {
		return mapMacOSVersion(version);
	}

	// Android/iOS 保持原样
	return version;
}

/**
 * 将解析结果转换为数据库存储格式
 */
export function toUAInfo(result: ParseResult): UAInfo {
	return {
		browser: result.browser.name,
		browserVersion: formatBrowserVersion(result.browser.version),
		os: result.os.name,
		osVersion: formatOSVersion(result.os.name, result.os.version),
		device: result.device.type,
	};
}

/**
 * 一键获取 UA 信息（用于提交评论）
 * 优先使用 Client Hints，不支持时回退到 UA 字符串
 */
export async function getUAInfo(): Promise<UAInfo> {
	// 优先尝试 Client Hints
	const chData = await getClientHintsData();
	if (chData) {
		const result = parse(chData);
		return toUAInfo(result);
	}

	// 回退到 UA 字符串解析
	if (typeof navigator !== "undefined" && navigator.userAgent) {
		const result = parseUA(navigator.userAgent);
		return toUAInfo(result);
	}

	// 兜底返回
	return {
		browser: UNKNOWN,
		browserVersion: UNKNOWN,
		os: UNKNOWN,
		osVersion: UNKNOWN,
		device: "desktop",
	};
}

export default {
	isClientHintsSupported,
	getLowEntropyData,
	getHighEntropyData,
	getClientHintsData,
	parse,
	parseUA,
	getClientInfo,
	getBrowserInfo,
	getPlatformInfo,
	isMobile,
	toUAInfo,
	getUAInfo,
};
