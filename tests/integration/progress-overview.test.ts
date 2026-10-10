import { describe, expect, it } from "vitest";
import { createActivity, listProjectProgress, recordProgress } from "@/server/services/progress.service";
import { createProject } from "@/server/services/projects.service";
import { hasTestDb, makeWorld, useTestDb, villaInput } from "../support/db";

describe.skipIf(!hasTestDb)("work & progress: all-projects overview", () => {
  useTestDb();

  it("has one row per visible project and never mixes progress between them", async () => {
    const w = await makeWorld();
    const second = await createProject(w.manager, villaInput(w.client.id));
    const a = await createActivity(w.manager, w.project.id, { phase: "CIVIL", name: "Columns" });
    await createActivity(w.manager, second.id, { phase: "EXCAVATION", name: "Earthwork" });
    await recordProgress(w.manager, a.id, { progress: 60, date: "2026-10-06" });

    const all = await listProjectProgress(w.manager, {});
    expect(all.total).toBe(2);
    expect(all.rows.find((r) => r.id === w.project.id)).toMatchObject({ progress: { CIVIL: 60, EXCAVATION: 0, overall: 20 }, next: { name: "Columns" } });
    expect(all.rows.find((r) => r.id === second.id)).toMatchObject({ progress: { CIVIL: 0, EXCAVATION: 0 }, next: { name: "Earthwork" } });

    const mine = await listProjectProgress(w.engineer, {});
    expect(mine.rows.map((r) => r.id)).toEqual([w.project.id]);
  });
});
