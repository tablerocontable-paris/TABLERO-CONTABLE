// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { seed, persist, load } from "../src/data/repository";
import {
  addTaskComment,
  collectTaskNotifications,
  visibleNotifications,
  taskNotifications,
} from "../src/domain/notifications";
import { createCalendarEvent, changeCalendarEvent, canViewCalendarEvent } from "../src/domain/laboratory-work";
import NotificationCenter from "../src/components/NotificationCenter";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";

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
    s.profiles = s.profiles.map((profile) => profile.id === "boss" ? { ...profile, companyIds: [] } : profile);
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
  it("notifies authorized recipients when a task is rescheduled", () => {
    const { s, task } = setup();
    s.activeId = "m1";
    const next = collectTaskNotifications(s, {
      ...s,
      tasks: s.tasks.map((row) => row.id === task.id ? { ...row, scheduledOn: `${row.month}-28` } : row),
    }, "m1");
    expect(next.notifications?.filter((notice) => notice.kind === "changed").map((notice) => notice.recipientId)).toContain("e0");
  });
  it.each([
    ["availability", { availableFrom: "2026-10-26" }],
    ["commercial tracking", { commercialTrackingEnabled: true }],
    ["dependency", { dependsOnTaskIds: ["other-task"] }],
  ])("notifies currently authorized recipients when %s changes", (_label, change) => {
    const { s, task } = setup();
    s.activeId = "boss";
    const next = collectTaskNotifications(s, {
      ...s,
      tasks: s.tasks.map((row) => row.id === task.id ? { ...row, ...change } : row),
    }, "boss");
    const notices = next.notifications || [];
    expect(notices.map((notice) => notice.recipientId).sort()).toEqual(["e0", "m1"]);
    expect(notices.every((notice) => notice.kind === "changed" && notice.title === "Tarea modificada")).toBe(true);
  });
  it("normalizes empty availability and dependency order and emits one generic notice for combined changes", () => {
    const { s, task } = setup();
    s.activeId = "boss";
    const equivalent = collectTaskNotifications(s, {
      ...s,
      tasks: s.tasks.map((row) => row.id === task.id ? {
        ...row, availableFrom: null, dependsOnTaskIds: [...(row.dependsOnTaskIds || [])].reverse(), commercialTrackingEnabled: false,
      } : row),
    }, "boss");
    expect(equivalent.notifications).toBeUndefined();
    const combined = collectTaskNotifications(s, {
      ...s,
      tasks: s.tasks.map((row) => row.id === task.id ? {
        ...row, availableFrom: "2026-10-27", dependsOnTaskIds: ["other-task"], commercialTrackingEnabled: true,
      } : row),
    }, "boss");
    expect(combined.notifications).toHaveLength(2);
    expect(new Set(combined.notifications?.map((notice) => notice.recipientId))).toEqual(new Set(["e0", "m1"]));
  });
  it("does not notify revoked recipients or disclose changed task and dependency titles", () => {
    const { s, task } = setup();
    s.activeId = "boss";
    const next = collectTaskNotifications(s, {
      ...s,
      profiles: s.profiles.map((profile) => profile.id === "m1" ? { ...profile, active: false } : profile),
      tasks: s.tasks.map((row) => row.id === task.id ? { ...row, dependsOnTaskIds: ["internal-dependency-title"] } : row),
    }, "boss");
    expect(next.notifications?.map((notice) => notice.recipientId)).toEqual(["e0"]);
    expect(next.notifications?.[0]?.title).toBe("Tarea modificada");
    expect(JSON.stringify(next.notifications)).not.toContain("internal-dependency-title");
    const unchanged = { ...s };
    expect(collectTaskNotifications(s, unchanged, "boss")).toBe(unchanged);
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
    next.activeId = "m1";
    next.notifications![0].readAt = new Date().toISOString();
    persist(next, true);
    expect(load(true).notifications).toEqual(next.notifications);
    expect(
      visibleNotifications({
        ...next,
        profiles: next.profiles.map((p) =>
          p.id === "m1" ? { ...p, companyIds: [] } : p,
        ),
      }),
    ).toHaveLength(0);
  });
  it("permite a jefatura comentar sin membresía directa y mantiene el comentario separado de la ejecución", () => {
    const { s, task } = setup();
    const bossWithoutCompany = { ...s, activeId: "boss", profiles: s.profiles.map((profile) => profile.id === "boss" ? { ...profile, companyIds: [] } : profile) };
    const next = addTaskComment(bossWithoutCompany, task.id, "Verificar el extracto antes del cierre.");
    expect(next.taskComments?.[0]).toMatchObject({ taskId: task.id, actorId: "boss", content: "Verificar el extracto antes del cierre." });
    expect(next.tasks.find((row) => row.id === task.id)?.status).toBe(task.status);
    expect(() => addTaskComment({ ...s, activeId: "e1" }, task.id, "Comentario de un par.")).toThrow();
  });
  it("supports joint activation events with the same access-filtered recipients", () => {
    const { s, task } = setup();
    expect(
      taskNotifications(s, task, "boss", "joint", "Tarea conjunta activada")
        .map((n) => n.recipientId)
        .sort(),
    ).toEqual(["e0", "m1"]);
  });

  it("reemplaza un aviso de calendario revocado por texto genérico sin detalles ni enlace", () => {
    const s = seed();
    const owner = s.profiles.find((profile) => profile.id === "e0")!;
    const created = createCalendarEvent(s, owner.id, {
      companyId: "c1", kind: "audit", title: "Auditoría reservada", description: "Detalle privado",
      startOn: "2026-10-22", endOn: "2026-10-22", recipientIds: [], linkedTaskId: null,
    }, "2026-10-01T12:00:00.000Z");
    const event = created.calendarEvents![0]!;
    const managerNotice = created.calendarNotices!.find((notice) => notice.recipientId === "m1")!;
    const changed = changeCalendarEvent(created, event.id, "e0", { title: "Auditoría interna crítica", startOn: "2026-10-29", endOn: "2026-10-29" }, false, "2026-10-02T12:00:00.000Z");
    const revoked = {
      ...changed, activeId: "m1",
      profiles: changed.profiles.map((profile) => profile.id === "m1" ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") } : profile),
      calendarNotices: changed.calendarNotices!.map((notice) => notice.id === managerNotice.id ? { ...notice, readAt: null } : notice),
    };
    const manager = revoked.profiles.find((profile) => profile.id === "m1")!;
    expect(canViewCalendarEvent(revoked, manager, revoked.calendarEvents![0]!)).toBe(false);
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    render(createElement(NotificationCenter, { state: revoked, commit: () => true, notify: () => {}, onOpenTask: () => {}, onOpenCalendar: () => {}, laboratory: true }));
    fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));
    expect(screen.getAllByText("El acceso a una fecha compartida fue actualizado.")).toHaveLength(2);
    expect(screen.queryByText("Auditoría interna crítica")).toBeNull();
    expect(screen.queryByRole("button", { name: /abrir calendario/i })).toBeNull();
  });

  it("retira título, fecha y enlace del aviso cuando cambia la jefatura del autor", () => {
    const state = seed();
    const owner = state.profiles.find((profile) => profile.id === "e0")!;
    const created = createCalendarEvent(state, owner.id, {
      companyId: "c1", kind: "audit", title: "Auditoría reservada por jerarquía", description: "Detalle privado",
      startOn: "2026-10-22", endOn: "2026-10-22", recipientIds: [], linkedTaskId: null,
    }, "2026-10-01T12:00:00.000Z");
    const sharedEvent = created.calendarEvents![0]!;
    const managerNotice = created.calendarNotices!.find((notice) => notice.recipientId === "m1")!;
    const changedHierarchy = {
      ...created, activeId: "m1",
      calendarEvents: [sharedEvent], calendarNotices: [managerNotice],
      profiles: created.profiles.map((profile) => profile.id === owner.id
        ? { ...profile, managerId: "m2", teamId: "t2" }
        : profile),
    };
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    const view = render(createElement(NotificationCenter, { state: changedHierarchy, commit: () => true, notify: () => {}, onOpenTask: () => {}, onOpenCalendar: () => {}, laboratory: true }));
    const ui = within(view.container);
    fireEvent.click(ui.getByRole("button", { name: /notificaciones/i }));
    expect(ui.getByText("El acceso a una fecha compartida fue actualizado.")).toBeTruthy();
    expect(ui.queryByText("Auditoría reservada por jerarquía")).toBeNull();
    expect(ui.queryByText("2026-10-22")).toBeNull();
    expect(ui.queryByRole("button", { name: /ver calendario/i })).toBeNull();
  });

  it("muestra la cancelación a destinatarios autorizados y no la expone tras revocar el ámbito", () => {
    const state = seed();
    const owner = state.profiles.find((profile) => profile.id === "e0")!;
    const created = createCalendarEvent(state, owner.id, {
      companyId: "c1", kind: "audit", title: "Auditoría cancelada reservada", description: "Detalle privado",
      startOn: "2026-10-22", endOn: "2026-10-22", recipientIds: [], linkedTaskId: null,
    }, "2026-10-01T12:00:00.000Z");
    const event = created.calendarEvents![0]!;
    const cancelled = changeCalendarEvent(created, event.id, owner.id, {}, true, "2026-10-02T12:00:00.000Z");
    const managerNotice = cancelled.calendarNotices!.find((notice) => notice.recipientId === "m1" && notice.kind === "cancelled")!;
    const authorized = { ...cancelled, activeId: "m1", calendarNotices: [managerNotice] };
    const revoked = {
      ...authorized,
      profiles: authorized.profiles.map((profile) => profile.id === "m1"
        ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
        : profile),
    };
    const makeUI = (snapshot: typeof authorized) => {
      const view = render(createElement(NotificationCenter, { state: snapshot, commit: () => true, notify: () => {}, onOpenTask: () => {}, onOpenCalendar: () => {}, laboratory: true }));
      const ui = within(view.container);
      fireEvent.click(ui.getByRole("button", { name: /notificaciones/i }));
      return { view, ui };
    };

    const first = makeUI(authorized);
    expect(first.ui.getByText("Fecha cancelada · Auditoría cancelada reservada")).toBeTruthy();
    expect(first.ui.getByText("2026-10-22 · Valentino Magni")).toBeTruthy();
    first.view.unmount();

    const second = makeUI(revoked);
    expect(second.ui.getByText("El acceso a una fecha compartida fue actualizado.")).toBeTruthy();
    expect(second.ui.queryByText(/Auditoría cancelada reservada/)).toBeNull();
    expect(second.ui.queryByText("2026-10-22 · Valentino Magni")).toBeNull();
    expect(second.ui.queryByRole("button", { name: /ver calendario/i })).toBeNull();
  });
});
