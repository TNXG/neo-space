"use client";

import type { Note, Post, RecentlyWithRendered, User } from "@/types/api";
import { motion, useScroll, useTransform } from "motion/react";
import { ArticlesSection } from "./home/ArticlesSection";
import { NotesSection } from "./home/NotesSection";
import { ProfileHeader } from "./home/ProfileHeader";
import { RecentlySection } from "./home/RecentlySection";

interface HomePageProps {
  profile: User;
  articles: Post[];
  notes: Note[];
  recently: RecentlyWithRendered[];
}

/**
 * Homepage client component
 * Main entry point for the homepage, receives data from server component
 */
export function HomePage({ profile, articles, notes, recently }: HomePageProps) {
  const { scrollYProgress } = useScroll();
  const characterRotate = useTransform(scrollYProgress, [0, 0.35], [0, 42]);
  const characterTranslateX = useTransform(scrollYProgress, [0, 0.35], ["0%", "140%"]);
  const characterOpacity = useTransform(scrollYProgress, [0, 0.25, 0.35], [1, 1, 0]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background font-sans text-foreground antialiased transition-colors duration-200">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-[max(0px,calc((100vw-42.5rem)/2-1.5rem))] items-center justify-end overflow-hidden min-[90rem]:flex"
      >
        <motion.img
          src="https://cdn.tnxg.top/images/cover/background_aijo_karen.webp"
          alt="background_aijo_karen"
          className="h-auto max-h-[124vh] w-auto max-w-[124%] object-contain"
          style={{
            opacity: characterOpacity,
            rotate: characterRotate,
            x: characterTranslateX,
            transformOrigin: "72% 50%",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto max-w-170 space-y-16 px-4 py-16 pb-24 md:px-6 md:py-20 md:pb-32">
        <ProfileHeader profile={profile} />
        <ArticlesSection articles={articles} />
        <NotesSection notes={notes} />
        <RecentlySection recently={recently} />
      </main>
    </div>
  );
}
