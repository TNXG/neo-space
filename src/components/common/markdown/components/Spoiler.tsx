"use client";

import { motion } from "motion/react";
import { useState } from "react";

export const Spoiler = ({ children }: { children: React.ReactNode }) => {
	const [revealed, setRevealed] = useState(false);

	return (
		<motion.span
			className="inline-block cursor-pointer rounded px-1 py-0.5"
			onClick={() => setRevealed(!revealed)}
			initial={false}
			animate={{
				backgroundColor: revealed ? "transparent" : "var(--primary-400)",
				color: revealed ? "inherit" : "transparent",
			}}
			whileHover={!revealed ? { scale: 1.02 } : undefined}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			{children}
		</motion.span>
	);
};
