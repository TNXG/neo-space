"use client";

import { useEffect } from "react";

import { registerServiceWorkerWhenIdle } from "@/lib/service-worker/client";

/** 在首屏加载完成后静默注册资源线路 Service Worker。 */
export function ServiceWorkerProvider() {
  useEffect(() => registerServiceWorkerWhenIdle(), []);
  return null;
}
