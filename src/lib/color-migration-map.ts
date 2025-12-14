/**
 * Color System Migration Map
 * Maps old custom color classes to new Tailwind CSS classes
 */

export interface ClassMigration {
	oldClass: string;
	newClass: string;
	cssVariable: string;
	category: "background" | "text" | "border" | "accent";
	description: string;
}

export const COLOR_MIGRATION_MAP: ClassMigration[] = [
	// Background Colors - 语义化命名
	{
		oldClass: "bg-primary",
		newClass: "bg-neutral-50", // 主要背景 -> 中性色浅色
		cssVariable: "--neutral-50",
		category: "background",
		description: "Primary background color",
	},
	{
		oldClass: "bg-secondary",
		newClass: "bg-neutral-100", // 次要背景 -> 中性色更浅
		cssVariable: "--neutral-100",
		category: "background",
		description: "Secondary background color",
	},
	{
		oldClass: "bg-card",
		newClass: "bg-surface-50", // 卡片背景 -> 表面色
		cssVariable: "--surface-50",
		category: "background",
		description: "Card background color",
	},
	{
		oldClass: "bg-glass",
		newClass: "bg-surface-200", // 玻璃效果 -> 半透明表面色
		cssVariable: "--surface-200",
		category: "background",
		description: "Glass morphism background",
	},
	{
		oldClass: "bg-accent",
		newClass: "bg-accent-500", // 强调色 -> 标准强调色
		cssVariable: "--accent-500",
		category: "accent",
		description: "Accent background color",
	},
	{
		oldClass: "bg-accent-hover",
		newClass: "bg-accent-600", // 强调色悬停 -> 更深的强调色
		cssVariable: "--accent-600",
		category: "accent",
		description: "Accent hover background color",
	},
	{
		oldClass: "bg-accent-light",
		newClass: "bg-accent-100", // 浅强调色 -> 浅色强调色
		cssVariable: "--accent-100",
		category: "accent",
		description: "Light accent background color",
	},

	// Text Colors - 语义化命名
	{
		oldClass: "text-primary",
		newClass: "text-primary-900", // 主要文本 -> 深色主要色
		cssVariable: "--primary-900",
		category: "text",
		description: "Primary text color",
	},
	{
		oldClass: "text-secondary",
		newClass: "text-neutral-600", // 次要文本 -> 中性色中等深度
		cssVariable: "--neutral-600",
		category: "text",
		description: "Secondary text color",
	},
	{
		oldClass: "text-tertiary",
		newClass: "text-neutral-400", // 三级文本 -> 中性色较浅
		cssVariable: "--neutral-400",
		category: "text",
		description: "Tertiary text color",
	},
	{
		oldClass: "text-accent",
		newClass: "text-accent-600", // 强调文本 -> 强调色
		cssVariable: "--accent-600",
		category: "accent",
		description: "Accent text color",
	},
	{
		oldClass: "text-accent-hover",
		newClass: "text-accent-700", // 强调文本悬停 -> 更深强调色
		cssVariable: "--accent-700",
		category: "accent",
		description: "Accent hover text color",
	},

	// Border Colors - 语义化命名
	{
		oldClass: "border-light",
		newClass: "border-neutral-200", // 浅边框 -> 中性色浅色
		cssVariable: "--neutral-200",
		category: "border",
		description: "Light border color",
	},
	{
		oldClass: "border-default",
		newClass: "border-neutral-300", // 默认边框 -> 中性色中等
		cssVariable: "--neutral-300",
		category: "border",
		description: "Default border color",
	},
	{
		oldClass: "border-dark",
		newClass: "border-neutral-400", // 深边框 -> 中性色较深
		cssVariable: "--neutral-400",
		category: "border",
		description: "Dark border color",
	},
	{
		oldClass: "border-accent",
		newClass: "border-accent-500", // 强调边框 -> 强调色
		cssVariable: "--accent-500",
		category: "accent",
		description: "Accent border color",
	},
];

// Hover state mappings - 语义化命名
export const HOVER_MIGRATION_MAP: ClassMigration[] = [
	{
		oldClass: "hover:bg-accent-light",
		newClass: "hover:bg-accent-200", // 悬停浅强调色
		cssVariable: "--accent-200",
		category: "accent",
		description: "Hover accent light background",
	},
	{
		oldClass: "hover:bg-accent",
		newClass: "hover:bg-accent-600", // 悬停强调色
		cssVariable: "--accent-600",
		category: "accent",
		description: "Hover accent background",
	},
	{
		oldClass: "hover:bg-accent-hover",
		newClass: "hover:bg-accent-700", // 悬停深强调色
		cssVariable: "--accent-700",
		category: "accent",
		description: "Hover accent hover background",
	},
	{
		oldClass: "hover:text-accent",
		newClass: "hover:text-accent-700", // 悬停强调文本
		cssVariable: "--accent-700",
		category: "accent",
		description: "Hover accent text",
	},
	{
		oldClass: "hover:text-accent-hover",
		newClass: "hover:text-accent-800", // 悬停深强调文本
		cssVariable: "--accent-800",
		category: "accent",
		description: "Hover accent hover text",
	},
	{
		oldClass: "hover:border-accent",
		newClass: "hover:border-accent-600", // 悬停强调边框
		cssVariable: "--accent-600",
		category: "accent",
		description: "Hover accent border",
	},
	{
		oldClass: "hover:border-default",
		newClass: "hover:border-neutral-400", // 悬停默认边框
		cssVariable: "--neutral-400",
		category: "border",
		description: "Hover default border",
	},
	{
		oldClass: "hover:border-light",
		newClass: "hover:border-neutral-300", // 悬停浅边框
		cssVariable: "--neutral-300",
		category: "border",
		description: "Hover light border",
	},
	{
		oldClass: "hover:border-dark",
		newClass: "hover:border-neutral-500", // 悬停深边框
		cssVariable: "--neutral-500",
		category: "border",
		description: "Hover dark border",
	},
];

// Combined migration map
export const ALL_MIGRATIONS = [...COLOR_MIGRATION_MAP, ...HOVER_MIGRATION_MAP];

/**
 * Get migration mapping for a specific class
 */
export function getMigrationForClass(oldClass: string): ClassMigration | undefined {
	return ALL_MIGRATIONS.find(migration => migration.oldClass === oldClass);
}

/**
 * Get all migrations by category
 */
export function getMigrationsByCategory(category: ClassMigration["category"]): ClassMigration[] {
	return ALL_MIGRATIONS.filter(migration => migration.category === category);
}

/**
 * Replace old class with new class in a className string
 */
export function migrateClassName(className: string): string {
	let migratedClassName = className;

	ALL_MIGRATIONS.forEach((migration) => {
		const regex = new RegExp(`\\b${migration.oldClass}\\b`, "g");
		migratedClassName = migratedClassName.replace(regex, migration.newClass);
	});

	return migratedClassName;
}

/**
 * Find all old classes in a className string
 */
export function findOldClassesInString(className: string): string[] {
	const foundClasses: string[] = [];

	ALL_MIGRATIONS.forEach((migration) => {
		const regex = new RegExp(`\\b${migration.oldClass}\\b`);
		if (regex.test(className)) {
			foundClasses.push(migration.oldClass);
		}
	});

	return foundClasses;
}
