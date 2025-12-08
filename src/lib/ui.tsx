"use client";

import type { ReactNode } from "react";
import type { UIContextValue } from "./context/ui-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UIContext } from "./context/ui-context";

interface DrawerState {
	open: boolean;
	content: ReactNode | null;
}

export function UIProvider({ children }: { children: ReactNode }) {
	const [drawer, setDrawer] = useState<DrawerState>({
		open: false,
		content: null,
	});

	useEffect(() => {
		document.body.style.overflow = drawer.open ? "hidden" : "auto";
	}, [drawer.open]);

	const openDrawer = useCallback((content: ReactNode) => {
		setDrawer({ content, open: true });
	}, []);

	const closeDrawer = useCallback(() => {
		setDrawer(prev => ({ ...prev, open: false }));
		setTimeout(() => setDrawer({ open: false, content: null }), 300);
	}, []);

	const value: UIContextValue = useMemo(
		() => ({
			drawerOpen: drawer.open,
			drawerContent: drawer.content,
			openDrawer,
			closeDrawer,
		}),
		[drawer.open, drawer.content, openDrawer, closeDrawer],
	);

	return <UIContext value={value}>{children}</UIContext>;
}
