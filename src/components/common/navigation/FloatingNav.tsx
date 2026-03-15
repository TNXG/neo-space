"use client";

import type { User } from "@/types/api";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { SearchPanel } from "@/components/common/search/SearchPanel";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useReaderWS } from "@/hooks/use-reader-ws";

import { BackToTopFab } from "./BackToTopFab";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { TopNav } from "./TopNav";
import { useScrollTracking } from "./useScrollTracking";

interface FloatingNavProps {
  user: User;
}

export function FloatingNav({ user }: FloatingNavProps) {
  const hasMounted = useHasMounted();
  const { isConnected, onlineCount } = useReaderWS();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { readingProgress, showBackToTop, isNavVisible, setIsNavVisible, scrollToTop } =
    useScrollTracking({ hasMounted });

  return (
    <>
      <MobileNavDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      <TopNav
        user={user}
        isNavVisible={isNavVisible}
        setIsNavVisible={setIsNavVisible}
        setIsDrawerOpen={setIsDrawerOpen}
        setIsSearchOpen={setIsSearchOpen}
        isConnected={isConnected}
        onlineCount={onlineCount}
      />

      {showBackToTop && (
        <BackToTopFab readingProgress={readingProgress} scrollToTop={scrollToTop} />
      )}

      <AnimatePresence>
        <SearchPanel open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      </AnimatePresence>
    </>
  );
}
