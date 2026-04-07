"use client";

import type { SpecialCodeBlockProps } from "./types";
import { CargoBlock } from "./cargo-block";
import { TokeiBlock } from "./tokei-block";

export function SpecialCodeBlock({ language, raw }: SpecialCodeBlockProps) {
  if (language === "tokei") {
    return <TokeiBlock raw={raw} />;
  }

  return <CargoBlock raw={raw} />;
}
