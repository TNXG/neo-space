import type { SVGProps } from "react";
import catppuccinIcons from "@iconify-json/catppuccin/icons.json";
import { iconToSVG } from "@iconify/utils";

// 扩展名映射表
const ext2lang: Record<string, string> = {
	js: "javascript",
	jsx: "javascript-react",
	ts: "typescript",
	tsx: "typescript-react",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	c: "c",
	cpp: "cpp",
	cs: "csharp",
	html: "html",
	css: "css",
	json: "json",
	md: "markdown",
	sh: "bash",
	yaml: "yaml",
	xml: "xml",
	sql: "database",
	vue: "vue",
	react: "javascript-react",
	dockerfile: "docker",
	makefile: "makefile",
};

function getIconData(iconKey: string) {
	const icons = catppuccinIcons.icons as Record<string, { body: string; width?: number; height?: number }>;
	return Object.prototype.hasOwnProperty.call(icons, iconKey) ? icons[iconKey] : null;
}

/**
 * 获取文件对应的图标组件
 */
export function FileIcon({ extension, className, ...props }: { extension?: string } & SVGProps<SVGSVGElement>) {
	if (!extension)
		return null;

	// 处理扩展名归一化
	const normalizedExt = extension.toLowerCase();
	const fileType = ext2lang[normalizedExt] || normalizedExt;
	const iconKey = fileType; // Catppuccin json key 通常直接是类型名

	let iconData = getIconData(iconKey);

	// 如果找不到具体语言图标，回退到通用文件图标
	if (!iconData) {
		iconData = getIconData("file");
	}

	if (!iconData)
		return null;

	const svgData = iconToSVG(iconData);

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${svgData.attributes.width} ${svgData.attributes.height}`}
			className={className}
			// 可信的内部资源
			// eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
			dangerouslySetInnerHTML={{ __html: svgData.body }}
			{...props}
		/>
	);
}
