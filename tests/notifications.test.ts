// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { seed, persist, load } from "../src/data/repository";
import {
  addTaskComment,
  collectTaskNotifications,
  visibleNotifications,
  taskNotifications,
} from "../src/domain/notifications";

describe("avisos por destinatario del laboratorio", () => {
  function setup() {
    const s = seed();
    s.activeId = "e0";
    const task = s.tasks.find((t) => t.ownerId === "e0")!;
    task.status = "En curso";
    return { s, task };
  }
  it("notifies the manager and boss on completion, not peers or the actor", () => {
    const { s, task } = setup();
    const next = collectTaskNotifications(
      s,
      {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === task.id ? { ...t, status: "Completada" } : t,
        ),
      },
      "e0",
    );
    expect(next.notifications?.map((n) => n.recipientId).sort()).toEqual([
      "boss",
      "m1",
    ]);
    expect(next.notifications?.every((n) => n.kind === "completed")).toBe(true);
    expect(visibleNotifications(next)).toHaveLength(0);
    expect(visibleNotifications({ ...next, activeId: "boss" })).toHaveLength(1);
  });
  it("notifies a recipient of an assigned task and does not duplicate events on read/profile changes", () => {
    const { s, task } = setup();
    s.activeId = "boss";
    const next = collectTaskNotifications(
      s,
      { ...s, tasks: [...s.tasks, { ...task, id: "new-task" }] },
      "boss",
    );
    expect(
      next.notifications?.some(
        (n) => n.recipientId === "e0" && n.kind === "assigned",
      ),
    ).toBe(true);
    const saved = collectTaskNotifications(
      next,
      { ...next, activeId: "e0" },
      "boss",
    );
    expect(saved.notifications).toEqual(next.notifications);
  });
  it("comments notify the task owner but never expose personal annotations", () => {
    const { s, task } = setup();
    s.activeId = "boss";
    const next = collectTaskNotifications(
      s,
      addTaskComment(s, task.id, "Revisar comprobantes"),
      "boss",
    );
    expect(
      next.notifications?.some(
        (n) => n.recipientId === "e0" && n.kind === "comment",
      ),
    ).toBe(true);
    expect(
      next.notifications?.some((n) => n.title.includes("comprobantes")),
    ).toBe(false);
    const personal = {
      ...s,
      annotations: [
        {
          id: "private",
          ownerId: "boss",
          title: "Secret",
          content: "Private",
          kind: "personal" as const,
          reminderOn: null,
          createdAt: "",
          updatedAt: "",
          convertedTaskId: null,
        },
      ],
    };
    expect(
      collectTaskNotifications(s, personal, "boss").notifications,
    ).toBeUndefined();
  });
  it("rejects peer comments, removes notices after loss of access and persists read status", () => {
    const { s, task } = setup();
    expect(() =>
      addTaskComment({ ...s, activeId: "e1" }, task.id, "No"),
    ).toThrow();
    const next = collectTaskNotifications(
      s,
      addTaskComment(s, task.id, "Comentario"),
      "e0",
    );
    next.activeId = "boss";
    next.notifications![0].readAt = new Date().toISOString();
    persist(next, true);
    expect(load(true).notifications).toEqual(next.notifications);
    expect(
      visibleNotifications({
        ...next,
        profiles: next.profiles.map((p) =>
          p.id === "boss" ? { ...p, companyIds: [] } : p,
        ),
      }),
    ).toHaveLength(0);
  });
  it("supports joint activation events with the same access-filtered recipients", () => {
    const { s, task } = setup();
    expect(
      taskNotifications(s, task, "boss", "joint", "Tarea conjunta activada")
        .map((n) => n.recipientId)
        .sort(),
    ).toEqual(["e0", "m1"]);
  });
});
