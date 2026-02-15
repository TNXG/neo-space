"use client";

import { icons as mingcuteIcons } from "@iconify-json/mingcute";
import { addCollection } from "@iconify/react/offline";

export function IconProvider({ children }: { children: React.ReactNode }) {
  addCollection(mingcuteIcons);

  console.log("Iconify offline mode initialized with mingcute icons:", Object.keys(mingcuteIcons.icons).length, "icons loaded");

  return <>{children}</>;
}
