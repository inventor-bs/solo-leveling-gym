import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { HunterRepo } from "../repositories/hunter.repo";
import { hunter } from "./hunter";

let db: Db;

beforeEach(async () => {
  db = await makeTestDb();
});

describe("the voice tone column", () => {
  it("is declared on the hunter table", () => {
    expect(Object.keys(hunter)).toEqual(expect.arrayContaining(["voiceTone"]));
  });

  it("REGRESSION: starts null, which is the Cold voice every hunter already has", async () => {
    // The live production row conforms to this the instant the migration
    // applies: ADD COLUMN writes no rows, and null is already the right
    // answer for a hunter who has bought nothing.
    const hunters = new HunterRepo(db);
    const created = await hunters.create({ name: "Jin-Woo", createdAt: 0 });
    expect(created.voiceTone).toBeNull();
  });

  it("writes and clears through the existing HunterPatch", async () => {
    const hunters = new HunterRepo(db);
    await hunters.create({ name: "Jin-Woo", createdAt: 0 });

    await hunters.update({ voiceTone: "ancient" });
    expect((await hunters.get())?.voiceTone).toBe("ancient");

    await hunters.update({ voiceTone: null });
    expect((await hunters.get())?.voiceTone).toBeNull();
  });

  it("leaves the title and the frame beside it untouched", async () => {
    const hunters = new HunterRepo(db);
    await hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await hunters.update({ title: "unyielding", titleFrame: "system" });
    await hunters.update({ voiceTone: "mocking" });

    const row = await hunters.get();
    expect(row?.title).toBe("unyielding");
    expect(row?.titleFrame).toBe("system");
    expect(row?.voiceTone).toBe("mocking");
  });
});
