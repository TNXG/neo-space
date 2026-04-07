import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollTrackingOptions {
  hasMounted: boolean;
}

interface ScrollTrackingResult {
  readingProgress: number;
  showBackToTop: boolean;
  isNavVisible: boolean;
  setIsNavVisible: (visible: boolean) => void;
  scrollToTop: () => void;
}

export function useScrollTracking({
  hasMounted,
}: ScrollTrackingOptions): ScrollTrackingResult {
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

  const scroll = useRef({
    lastY: 0,
    downAccum: 0,
    upAccum: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    showBackToTop: false,
  }).current;

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    if (!hasMounted)
      return;

    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(docHeight > 0 ? (scrollY / docHeight) * 100 : 0, 100);
    const shouldShow = scrollY > 300;

    if (scroll.showBackToTop !== shouldShow) {
      scroll.showBackToTop = shouldShow;
      setShowBackToTop(shouldShow);
    }
    setReadingProgress(progress);

    const delta = scrollY - scroll.lastY;
    if (delta > 0) {
      scroll.downAccum += delta;
      scroll.upAccum = 0;
    } else if (delta < 0) {
      scroll.upAccum += Math.abs(delta);
      scroll.downAccum = 0;
    }

    if (scrollY < 100) {
      setIsNavVisible(true);
      scroll.downAccum = 0;
      scroll.upAccum = 0;
    } else if (scroll.downAccum > 180) {
      setIsNavVisible(false);
      scroll.downAccum = 0;
    } else if (scroll.upAccum > 40) {
      setIsNavVisible(true);
      scroll.upAccum = 0;
    }

    scroll.lastY = scrollY;

    if (scroll.timer)
      clearTimeout(scroll.timer);
    scroll.timer = setTimeout(setIsNavVisible, 2500, true);
  }, [hasMounted, scroll]);

  useEffect(() => {
    if (!hasMounted)
      return;
    requestAnimationFrame(() => handleScroll());
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMounted, handleScroll]);

  return {
    readingProgress,
    showBackToTop,
    isNavVisible,
    setIsNavVisible,
    scrollToTop,
  };
}
