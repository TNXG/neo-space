"use client";

import type { User } from "@/types/api";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { SearchPanel } from "@/components/common/search";
import { SettingsDialog } from "@/components/layouts/settings/SettingsDialog";
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { readingProgress, showBackToTop, isNavVisible, setIsNavVisible, scrollToTop }
    = useScrollTracking({ hasMounted });

  return (
    <>
      <MobileNavDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      <TopNav
        user={user}
        isNavVisible={isNavVisible}
        setIsNavVisible={setIsNavVisible}
        setIsDrawerOpen={setIsDrawerOpen}
        setIsSearchOpen={setIsSearchOpen}
        setIsSettingsOpen={setIsSettingsOpen}
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
