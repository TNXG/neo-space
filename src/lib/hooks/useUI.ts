import { use } from "react";
import { UIContext } from "../context/ui-context";

export function useUI() {
	const context = use(UIContext);
	if (!context) {
		throw new Error("useUI must be used within UIProvider");
	}
	return context;
}
