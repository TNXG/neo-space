"use client";

import { useHasMounted } from "@/hook/use-has-mounted";

interface ClientOnlySpanProps {
	id?: string;
	className?: string;
	children: React.ReactNode;
	node?: any;
	[key: string]: any;
}

export function ClientOnlySpan({ children, node: _node, ...props }: ClientOnlySpanProps) {
	const isMounted = useHasMounted();

	if (!isMounted) {
		const { id: _id, ...rest } = props;
		return <span {...rest}>{children}</span>;
	}

	// 客户端渲染完整的 span
	return <span {...props}>{children}</span>;
}
