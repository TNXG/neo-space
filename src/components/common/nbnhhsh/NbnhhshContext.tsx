"use client";

import type { ReactNode } from "react";
import type { TranslationResult } from "./context";
import { useCallback, useMemo, useState } from "react";
import { guessAbbreviation } from "@/lib/api-client";
import { NbnhhshContext } from "./context";

export function NbnhhshProvider({ children }: { children: ReactNode }) {
	const [results, setResults] = useState<TranslationResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

	const query = useCallback(async (text: string, pos?: { x: number; y: number }) => {
		setIsLoading(true);
		if (pos) {
			setPosition(pos);
		}
		setIsOpen(true);
		try {
			const data = await guessAbbreviation(text);
			setResults(Array.isArray(data) ? data : []);
		} catch {
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const clear = useCallback(() => {
		setResults([]);
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
	}, []);

	const value = useMemo(
		() => ({ results, isLoading, isOpen, position, query, clear, close }),
		[results, isLoading, isOpen, position, query, clear, close],
	);

	return (
		<NbnhhshContext value={value}>
			{children}
		</NbnhhshContext>
	);
}
