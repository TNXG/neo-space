import type { ReactNode } from "react";
import { createContext } from "react";

export interface UIContextValue {
	drawerOpen: boolean;
	drawerContent: ReactNode | null;
	openDrawer: (content: ReactNode) => void;
	closeDrawer: () => void;
}

export const UIContext = createContext<UIContextValue | undefined>(undefined);
