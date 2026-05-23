import type { NoteModel } from "~/models/note";

import { notesApi } from "~/api";
import { createMemoDataListFetchHook } from "~/hooks/use-memo-fetch-data-list";

export const useMemoNoteList = createMemoDataListFetchHook<
  { _id: string; title: string; nid: number },
  NoteModel
>(page =>
  notesApi.getList({
    page,
    size: 50,
    select: "nid title _id",
  }),
);
