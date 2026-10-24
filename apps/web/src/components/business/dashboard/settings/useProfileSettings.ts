"use client";

import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  DASHBOARD_PROFILE_KEY,
  DASHBOARD_SESSION_KEY,
  getDashboardProfile,
  updateDashboardProfile,
} from "@/lib/dashboard-api";
import type { Reader, User } from "@/types/api";
import {
  createProfileDraft,
  profileChanges,
  profileError,
  type BasicProfileField,
  type ProfileDraft,
  type SocialProfileField,
} from "./profile-settings-model";

interface ProfileEdit {
  original: User;
  draft: ProfileDraft;
}

/** Manage a resettable profile draft and retain all edits when saving or refreshing fails. */
export function useProfileSettings() {
  const { data, error, isValidating, mutate } = useSWR<User>(DASHBOARD_PROFILE_KEY, getDashboardProfile);
  const { mutate: mutateCache } = useSWRConfig();
  const [edit, setEdit] = useState<ProfileEdit | null>(null);
  const [pending, setPending] = useState(false);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);
  const original = edit?.original ?? data;
  const draft = edit?.draft ?? (data ? createProfileDraft(data) : undefined);
  const changes = original && draft ? profileChanges(original, draft) : {};
  const dirty = Object.keys(changes).length > 0;

  /** Update a basic field while retaining newly added, still-empty social rows. */
  function change(group: "basic", key: BasicProfileField, value: string) {
    if (inFlight.current || awaitingRefresh) return;
    setSaveError("");
    setSuccess("");
    setEdit((current) => {
      const source = current?.original ?? data;
      if (!source) return current;
      const currentDraft = current?.draft ?? createProfileDraft(source);
      const next = { ...currentDraft, [group]: { ...currentDraft[group], [key]: value } };
      return { original: source, draft: next };
    });
  }

  /** Replace the visible social rows; payload generation clears removed or switched platforms. */
  function changeSocialEntries(keys: SocialProfileField[], values: Record<SocialProfileField, string>) {
    if (inFlight.current || awaitingRefresh) return;
    setSaveError("");
    setSuccess("");
    setEdit((current) => {
      const source = current?.original ?? data;
      if (!source) return current;
      const currentDraft = current?.draft ?? createProfileDraft(source);
      return { original: source, draft: { ...currentDraft, socialKeys: keys, social: values } };
    });
  }

  /** Restore the original profile and row list, including unsaved empty entries. */
  function reset() {
    if (inFlight.current || awaitingRefresh) return;
    setEdit(null);
    setSaveError("");
    setSuccess("");
  }

  /** Adopt the authoritative saved profile only after its read and cache update succeed. */
  async function readSavedProfile() {
    const fresh = await getDashboardProfile();
    await mutate(fresh, { revalidate: false });
    setEdit(null);
    setAwaitingRefresh(false);
    setSaveError("");
    setSuccess("个人资料已保存，并已读取最新资料。");
  }

  /** Save actual changes once and retain the draft when an API request fails. */
  async function save() {
    if (inFlight.current || !dirty || awaitingRefresh) return;
    inFlight.current = true;
    setPending(true);
    setSaveError("");
    setSuccess("");
    let saved = false;
    try {
      const reader = await updateDashboardProfile(changes);
      saved = true;
      setAwaitingRefresh(true);
      await mutateCache<Reader | null>(DASHBOARD_SESSION_KEY, (current: Reader | null | undefined) => ({
        ...reader,
        isOwner: current?.isOwner === true || reader.isOwner,
      }), { revalidate: false });
      await readSavedProfile();
    } catch (cause) {
      setSaveError(saved
        ? `资料已保存，但未能重新读取最新资料。请重试刷新，不要重复提交。${profileError(cause)}`
        : `保存失败，输入内容已保留。${profileError(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  /** Retry loading, or refresh after a successful save without submitting it twice. */
  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      if (awaitingRefresh) await readSavedProfile();
      else await mutate();
    } catch (cause) {
      setSaveError(awaitingRefresh
        ? `资料已保存，但仍无法读取最新资料。${profileError(cause)}`
        : `读取资料失败。${profileError(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return {
    draft, dirty, canReset: edit !== null, pending, awaitingRefresh, saveError, success,
    loadError: error ? profileError(error) : "",
    loading: !data && !error,
    isValidating,
    change, changeSocialEntries, reset, save, retry,
  };
}
