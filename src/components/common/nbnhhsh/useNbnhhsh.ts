"use client";

import { use } from "react";
import { NbnhhshContext } from "./context";

export function useNbnhhsh() {
	const ctx = use(NbnhhshContext);
	if (!ctx)
		throw new Error("useNbnhhsh must be used within NbnhhshProvider");
	return ctx;
}
