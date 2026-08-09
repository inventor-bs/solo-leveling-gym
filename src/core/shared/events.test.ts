import { describe, it, expect } from "vitest";
import { gold } from "./units";
import type { DomainEvent, DomainEventOfType } from "./events";

describe("Phase 5 domain events", () => {
  it("mirrors GoldGained's shape for GoldSpent", () => {
    const spent: DomainEventOfType<"GoldSpent"> = {
      type: "GoldSpent",
      amount: gold(2_500),
      source: "red-gate",
    };
    expect(spent.amount).toBe(2_500);
    expect(spent.source).toBe("red-gate");
  });

  it("records what dropped, where it went, and what it replaced", () => {
    const fresh: DomainEventOfType<"EquipmentDropped"> = {
      type: "EquipmentDropped",
      slot: "weapon",
      name: "Knight Killer",
      grade: "rare",
      replacedGrade: null,
    };
    const upgrade: DomainEventOfType<"EquipmentDropped"> = {
      ...fresh,
      grade: "epic",
      replacedGrade: "rare",
    };
    expect(fresh.replacedGrade).toBeNull();
    expect(upgrade.replacedGrade).toBe("rare");
  });

  it("carries both outcomes of a Red Gate", () => {
    const cleared: DomainEventOfType<"RedGateCleared"> = {
      type: "RedGateCleared",
      day: "2026-08-09",
    };
    const failed: DomainEventOfType<"RedGateFailed"> = {
      type: "RedGateFailed",
      day: "2026-08-09",
    };
    expect(cleared.day).toBe(failed.day);
  });

  it("records how many PRs cleared a Boss Raid and which floor fell", () => {
    const raid: DomainEventOfType<"BossRaidCleared"> = {
      type: "BossRaidCleared",
      day: "2026-08-09",
      prCount: 2,
    };
    const floor: DomainEventOfType<"DemonCastleFloorCleared"> = {
      type: "DemonCastleFloorCleared",
      floor: 3,
    };
    expect(raid.prCount).toBe(2);
    expect(floor.floor).toBe(3);
  });

  it("stamps the weekly events with the week they describe", () => {
    const week: DomainEventOfType<"PerfectWeek"> = {
      type: "PerfectWeek",
      weekStart: "2026-08-03",
      goldAwarded: gold(500),
    };
    const won: DomainEventOfType<"WagerWon"> = {
      type: "WagerWon",
      weekStart: "2026-08-03",
      stakeGold: gold(200),
      payoutGold: gold(600),
    };
    const lost: DomainEventOfType<"WagerLost"> = {
      type: "WagerLost",
      weekStart: "2026-08-03",
      stakeGold: gold(200),
    };
    expect(week.goldAwarded).toBe(500);
    expect(won.payoutGold).toBe(600);
    expect(lost.stakeGold).toBe(200);
  });

  it("keeps every new variant inside the DomainEvent union", () => {
    const all: DomainEvent["type"][] = [
      "GoldSpent",
      "EquipmentDropped",
      "RedGateCleared",
      "RedGateFailed",
      "BossRaidCleared",
      "DemonCastleFloorCleared",
      "PerfectWeek",
      "WagerWon",
      "WagerLost",
    ];
    expect(new Set(all).size).toBe(9);
  });
});
