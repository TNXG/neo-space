import { createContext } from "react";

export interface TranslationResult {
	name: string;
	trans?: string[] | null;
	inputting?: string[];
}

export interface NbnhhshContextType {
	results: TranslationResult[];
	isLoading: boolean;
	isOpen: boolean;
	position: { x: number; y: number } | null;
	query: (text: string, position?: { x: number; y: number }) => Promise<void>;
	clear: () => void;
	close: () => void;
}

export const NbnhhshContext = createContext<NbnhhshContextType | null>(null);
