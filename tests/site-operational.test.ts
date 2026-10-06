import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  operationalSeed,
  identify,
  projectState,
  applyProposal,
} from "../src/server/site-policy";
import worker from "../src/server/site-worker";
import {
  materialize,
  dateART,
  currentMonth,
  checkTask,
  closeMonth,
  type State,
  type Assignment,
} from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { applyClock } from "../src/domain/workforce";
const owner = "valentino@example.test";
function assignment(
  s: State,
  companyId = "c1",
  kind: "resultado" | "operativa" = "resultado",
): Assignment {
  const t = s.templates.find((t) => t.kind === kind)!;
  return {
    id: crypto.randomUUID(),
    templateId: t.id,
    title: t.title,
    ownerId: "e0",
    companyId,
    sector: t.sector,
    kind,
    weight: t.weight,
    unit: t.unit,
    target: t.target,
    day: Number(dateART().slice(-2)),
    frequency: "única",
    schedule: defaultSchedule(dateART()),
    steps: t.steps,
    startMonth: currentMonth(),
    priority: "Alta",
  };
}
function addTasks(s = operationalSeed(owner)) {
  s.assignments = [
    assignment(s, "c1"),
    assignment(s, "c2"),
    assignment(s, "c1", "operativa"),
  ];
  return materialize(s, currentMonth());
}
const actor = (s: State, id = "e0") => s.profiles.find((p) => p.id === id)!;
function save(s: State, p: State, id = "e0", now?: string) {
  return applyProposal(s, p, actor(s, id), "Prueba diaria", "", now);
}
describe("Sites: recorrido operativo y autorización real en servidor", () => {
  it("inicia sin empleados ficticios ni datos de demostración y separa cuenta técnica/KPI", () => {
    const s = operationalSeed(owner);
    expect(s.tasks).toEqual([]);
    expect(s.activity).toEqual([]);
    expect(s.assignments).toEqual([]);
    expect(s.profiles.map((p) => p.id)).toEqual(["boss", "m1", "e0", "admin"]);
    expect(identify(s, owner, owner, "e0").actor.role).toBe("empleado");
    expect(identify(s, owner, owner).actor.id).toBe("admin");
    expect(() => identify(s, "sin-perfil@example.test", owner)).toThrow(
      "perfil activo",
    );
  });
  it("completa inducción y crea una ocurrencia con controles por empresa", () => {
    const s = operationalSeed(owner);
    let p = projectState(s, actor(s));
    const a = assignment(s);
    p = materialize(
      {
        ...p,
        assignments: [a],
        onboarding: {
          ...p.onboarding,
          e0: {
            ...p.onboarding.e0,
            completedAt: new Date().toISOString(),
            step: 5,
          },
        },
      },
      currentMonth(),
    );
    const next = save(s, p);
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].companyId).toBe("c1");
    expect(next.tasks[0].checklist).toHaveLength(3);
    expect(next.onboarding.e0.completedAt).toBeTruthy();
    expect(next.profiles.find((p) => p.id === "admin")).toBeTruthy();
  });
  it("checklist completo sólo termina la tarjeta de su empresa; reapertura y cronómetro conservan historia", () => {
    let s = addTasks();
    let p = projectState(s, actor(s));
    const t = p.tasks[0];
    p = applyClock(p, t.id, "e0", true);
    s = save(s, p);
    expect(s.tasks[0].sessions?.[0].actorId).toBe("e0");
    p = projectState(s, actor(s));
    let complete = p.tasks[0];
    for (const c of complete.checklist)
      complete = checkTask(complete, c.id, true);
    p.tasks = p.tasks.map((x) => (x.id === complete.id ? complete : x));
    s = save(s, p);
    expect(s.tasks[0].status).toBe("Completada");
    expect(s.tasks[0].sessions?.[0].end).toBeTruthy();
    expect(s.tasks[1].status).toBe("Pendiente");
    p = projectState(s, actor(s));
    p.tasks[0] = checkTask(p.tasks[0], p.tasks[0].checklist[0].id, false);
    s = save(s, p);
    expect(s.tasks[0].reopenCount).toBe(1);
    expect(s.tasks[0].status).toBe("En curso");
  });
  it("guarda actividad y genera cierre con KPI calculado en el servidor, inmutable", () => {
    let s = addTasks();
    let p = projectState(s, actor(s));
    const op = p.tasks.find((t) => t.kind === "operativa")!;
    p.activity.push({
      id: "log1",
      taskId: op.id,
      date: dateART(),
      qty: op.target,
      note: "Carga del día",
      actorId: "e0",
      createdAt: new Date().toISOString(),
    });
    s = save(s, p);
    p = projectState(s, actor(s, "admin"));
    p = closeMonth(p, "e0", currentMonth(), "admin", "Revisado");
    p.closures[0].metrics.earned = 999999;
    s = save(s, p, "admin");
    expect(s.closures[0].metrics.earned).toBe(op.weight);
    expect(s.closures[0].report?.employee).toBe("Valentino Magni");
    p = projectState(s, actor(s));
    p.tasks[0].blockedBy = "Ventas";
    expect(() => save(s, p)).toThrow("cerrado");
    p = projectState(s, actor(s, "admin"));
    p.closures = [];
    expect(() => save(s, p, "admin")).toThrow("inmutables");
  });
  it("deniega cambio de rol, peso, empresa y cierre a un empleado", () => {
    const s = addTasks();
    let p = projectState(s, actor(s));
    p.profiles.find((p) => p.id === "e0")!.role = "jefe";
    expect(() => save(s, p)).toThrow("roles");
    p = projectState(s, actor(s));
    p.tasks[0].weight = 8;
    expect(() => save(s, p)).toThrow("identidad");
    p = projectState(s, actor(s));
    p.companies[0].name = "Cambio no autorizado";
    expect(() => save(s, p)).toThrow("jefatura");
    p = projectState(s, actor(s));
    p.closures = [
      {
        id: "bad",
        ownerId: "e0",
        month: currentMonth(),
        note: "Fraude",
      } as State["closures"][number],
    ];
    expect(() => save(s, p)).toThrow("jefatura");
  });
  it("no expone notas privadas a jefatura y conserva filas ocultas al guardar", () => {
    let s = addTasks();
    let p = projectState(s, actor(s));
    const now = new Date().toISOString();
    p.annotations = [
      {
        id: "private",
        ownerId: "e0",
        title: "Mi referencia",
        content: "Privado",
        kind: "personal",
        reminderOn: null,
        createdAt: now,
        updatedAt: now,
        convertedTaskId: null,
      },
    ];
    s = save(s, p);
    p = projectState(s, actor(s, "admin"));
    expect(p.annotations).toEqual([]);
    p.companies[0].name = "Empresa real";
    s = save(s, p, "admin");
    expect(s.annotations?.[0].content).toBe("Privado");
    p = projectState(s, actor(s, "admin"));
    p.annotations = [s.annotations![0]];
    expect(() => save(s, p, "admin")).toThrow("ámbito");
  });
  it("deniega empresa fuera del acceso y adulteración de una tarjeta recién materializada", () => {
    const s = operationalSeed(owner);
    s.profiles.find((p) => p.id === "e0")!.companyIds = ["c1"];
    let p = projectState(s, actor(s));
    p = materialize(
      { ...p, assignments: [assignment(s, "c2")] },
      currentMonth(),
    );
    expect(() => save(s, p)).toThrow("autorizadas");
    const base = operationalSeed(owner);
    p = projectState(base, actor(base));
    p = materialize({ ...p, assignments: [assignment(base)] }, currentMonth());
    p.tasks[0].status = "Completada";
    p.tasks[0].completedAt = new Date().toISOString();
    expect(() => save(base, p)).toThrow("proceso");
  });
  it("incorpora perfiles por correo sin cambiar actor; revoca acceso suspendido", () => {
    const s = operationalSeed(owner);
    const p = projectState(s, actor(s, "admin"));
    p.profiles.push({
      ...actor(s),
      id: "new",
      email: "nuevo@example.test",
      name: "Nuevo empleado",
    });
    p.onboarding.new = { ...p.onboarding.e0, name: "Nuevo empleado" };
    let next = save(s, p, "admin");
    expect(identify(next, "nuevo@example.test", owner).actor.id).toBe("new");
    next.profiles.find((p) => p.id === "new")!.active = false;
    expect(() => identify(next, "nuevo@example.test", owner)).toThrow("activo");
  });
  it("no acepta fechas futuras ni sesiones históricas manipuladas", () => {
    let s = addTasks();
    let p = projectState(s, actor(s));
    p = applyClock(p, p.tasks[0].id, "e0", true);
    s = save(s, p);
    p = projectState(s, actor(s));
    p.tasks[0].sessions![0].start = "2000-01-01T00:00:00Z";
    expect(() => save(s, p)).toThrow("tiempo");
    p = projectState(s, actor(s));
    const op = p.tasks.find((t) => t.kind === "operativa")!;
    p.activity = [
      {
        id: "future",
        taskId: op.id,
        date: "2099-01-01",
        qty: 1,
        note: "",
        actorId: "e0",
        createdAt: new Date().toISOString(),
      },
    ];
    expect(() => save(s, p)).toThrow("período");
  });
});
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync("drizzle/0000_sites_operational.sql", "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...args: unknown[]) {
        return statement(sql, args);
      },
      async first<T>() {
        return (db.prepare(sql).get(...(values as never[])) as T) || null;
      },
      async all<T>() {
        return { results: db.prepare(sql).all(...(values as never[])) as T[] };
      },
      async run() {
        if (sql.startsWith("SELECT"))
          return {
            meta: { changes: 0 },
            results: db.prepare(sql).all(...(values as never[])) as Record<
              string,
              unknown
            >[],
          };
        const r = db.prepare(sql).run(...(values as never[]));
        return { meta: { changes: Number(r.changes) } };
      },
    };
  }
  let queue = Promise.resolve();
  return {
    db,
    DB: {
      prepare: statement,
      batch(ss: ReturnType<typeof statement>[]) {
        const job = queue.then(async () => {
          db.exec("BEGIN");
          try {
            const results = [];
            for (const s of ss) results.push(await s.run());
            db.exec("COMMIT");
            return results;
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        });
        queue = job.then(
          () => {},
          () => {},
        );
        return job;
      },
    },
  };
}
describe("Worker y SQLite: acceso, persistencia y concurrencia de revisiones", () => {
  function setup() {
    const { DB, db } = database();
    const env = {
      DB,
      OWNER_EMAIL: owner,
      ASSETS: {
        async fetch() {
          return new Response("asset");
        },
      },
    };
    return { env, db };
  }
  function req(
    method = "GET",
    data?: unknown,
    email = owner,
    origin = "https://paris.test",
  ) {
    return new Request("https://paris.test/api/workspace", {
      method,
      headers: {
        "oai-authenticated-user-id": "site-user",
        "oai-authenticated-user-email": email,
        Origin: origin,
        "Content-Type": "application/json",
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  }
  it("requiere identidad, deniega terceros y escritura desde otro origen", async () => {
    const { env } = setup();
    expect(
      (await worker.fetch(new Request("https://paris.test/api/workspace"), env))
        .status,
    ).toBe(401);
    expect(
      (await worker.fetch(req("GET", undefined, "otro@example.test"), env))
        .status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          req("POST", {}, owner, "https://malicioso.test"),
          env,
        )
      ).status,
    ).toBe(403);
  });
  it("el cambio sobrevive una nueva sesión y rechaza una escritura con revisión vieja", async () => {
    const { env, db } = setup();
    const first = await (await worker.fetch(req(), env)).json();
    expect(first.state.tasks).toEqual([]);
    first.state.companies[0].name = "Empresa configurada";
    const saved = await worker.fetch(
      req("POST", {
        state: first.state,
        revision: first.revision,
        action: "Configuró empresas",
      }),
      env,
    );
    expect(saved.status).toBe(200);
    const second = await (await worker.fetch(req(), env)).json();
    expect(second.state.companies[0].name).toBe("Empresa configurada");
    expect(second.revision).toBe(1);
    expect(
      (
        await worker.fetch(
          req("POST", { state: first.state, revision: 0 }),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      db.prepare("SELECT revision FROM paris_workspace").get()?.revision,
    ).toBe(1);
  });
  it("dos escrituras concurrentes sólo confirman una versión", async () => {
    const { env } = setup();
    const first = await (await worker.fetch(req(), env)).json();
    const one = structuredClone(first.state),
      two = structuredClone(first.state);
    one.companies[0].name = "Uno";
    two.companies[0].name = "Dos";
    const result = await Promise.all([
      worker.fetch(req("POST", { state: one, revision: 0 }), env),
      worker.fetch(req("POST", { state: two, revision: 0 }), env),
    ]);
    expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
    const final = await (await worker.fetch(req(), env)).json();
    expect(final.revision).toBe(1);
    expect(final.state.companies[0].name).toBe(
      result[0].status === 200 ? "Uno" : "Dos",
    );
  });
  it("un empleado autenticado recibe sólo su ámbito y no puede pedir el perfil de jefe", async () => {
    const { env } = setup();
    const first = await (await worker.fetch(req(), env)).json();
    first.state.profiles.push({
      ...first.state.profiles.find((p: { id: string }) => p.id === "e0"),
      id: "staff",
      name: "Empleado real",
      email: "staff@example.test",
    });
    expect(
      (
        await worker.fetch(
          req("POST", { state: first.state, revision: 0 }),
          env,
        )
      ).status,
    ).toBe(200);
    const staff = await (
      await worker.fetch(req("GET", undefined, "staff@example.test"), env)
    ).json();
    expect(staff.state.activeId).toBe("staff");
    expect(staff.isOwner).toBe(false);
    staff.state.activeId = "admin";
    staff.state.companies[0].name = "Hack";
    expect(
      (
        await worker.fetch(
          req(
            "POST",
            { state: staff.state, revision: 1 },
            "staff@example.test",
          ),
          env,
        )
      ).status,
    ).toBe(422);
  });
  it("un error dentro del batch revierte la revisión y todas sus entidades", async () => {
    const { env, db } = setup();
    const initial = await (await worker.fetch(req(), env)).json();
    initial.state.companies[0].name = "Cambio que falla";
    const prepare = env.DB.prepare;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    env.DB.prepare = (sql: string) => {
      const base = prepare(sql);
      if (!sql.startsWith("INSERT INTO paris_records")) return base;
      return {
        ...base,
        bind(...args: unknown[]) {
          const bound = base.bind(...args);
          return {
            ...bound,
            async run() {
              throw Error("Simulated storage failure");
            },
          };
        },
      };
    };
    try {
      expect(
        (
          await worker.fetch(
            req("POST", { state: initial.state, revision: 0 }),
            env,
          )
        ).status,
      ).toBe(503);
    } finally {
      env.DB.prepare = prepare;
      log.mockRestore();
    }
    expect(
      db.prepare("SELECT revision FROM paris_workspace").get()?.revision,
    ).toBe(0);
    const final = await (await worker.fetch(req(), env)).json();
    expect(final.state.companies[0].name).toBe("Empresa 1");
  });
  it("usa el origen configurado para proteger un Worker detrás del dispatcher", async () => {
    const { env } = setup();
    const initial = await (await worker.fetch(req(), env)).json();
    const configured = { ...env, SITE_ORIGIN: "https://original-site.test" };
    expect(
      (
        await worker.fetch(
          req(
            "POST",
            { state: initial.state, revision: 0 },
            owner,
            "https://original-site.test",
          ),
          configured,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await worker.fetch(
          req("POST", { state: initial.state, revision: 1 }),
          configured,
        )
      ).status,
    ).toBe(403);
  });
});
