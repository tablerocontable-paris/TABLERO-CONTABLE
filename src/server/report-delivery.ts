/** Servidor exclusivamente. No importar desde componentes ni guardar claves aquí. */
export interface ClaimedDelivery {
  id: string;
  report_id: string;
  recipient_email: string;
  lease_token: string;
}
export type DeliveryErrorCode = "provider_unavailable" | "provider_rejected" | "acceptance_unknown";
export class ProviderFailure extends Error {
  constructor(public readonly code: DeliveryErrorCode, public readonly retryable: boolean) {
    super(code);
  }
}
export interface DeliveryStore {
  claim(limit: number): Promise<ClaimedDelivery[]>;
  complete(delivery: ClaimedDelivery, messageId: string): Promise<void>;
  fail(delivery: ClaimedDelivery, code: DeliveryErrorCode, retryable: boolean): Promise<void>;
}
export interface ReportNotice {
  to: string;
  subject: string;
  text: string;
}
export interface MailProvider {
  /** La deduplicación debe sobrevivir reinicios y conservar la misma clave. */
  supportsStableIdempotency: boolean;
  send(idempotencyKey: string, notice: ReportNotice): Promise<{ messageId: string }>;
}
export async function deliverReportBatch(
  store: DeliveryStore,
  provider: MailProvider,
  applicationOrigin: string,
  limit = 10,
): Promise<number> {
  const origin = new URL(applicationOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Se requiere el origen HTTPS de la app privada");
  }
  if (!provider.supportsStableIdempotency) throw new Error("Proveedor sin deduplicación estable; requiere reconciliación");
  const deliveries = await store.claim(limit);
  let sent = 0;
  for (const delivery of deliveries) {
    const url = new URL(`/reportes/${encodeURIComponent(delivery.report_id)}`, origin).href;
    let messageId: string;
    try {
      const accepted = await provider.send(delivery.id, {
        to: delivery.recipient_email,
        subject: "Reporte contable de cierre disponible",
        text: `Hay un reporte de cierre disponible. Ingresá con tu cuenta autorizada: ${url}`,
      });
      messageId = accepted.messageId;
    } catch (error) {
      // No persistir mensajes/excepciones del proveedor: pueden contener datos o secretos.
      const failure = error instanceof ProviderFailure ? error : new ProviderFailure("acceptance_unknown", true);
      await store.fail(delivery, failure.code, failure.retryable);
      continue;
    }
    // Si el ACK a la base falla, queda el lease. El siguiente intento usa la misma clave externa.
    await store.complete(delivery, messageId);
    sent++;
  }
  return sent;
}

/** Proveedor de pruebas, sin red; la persistencia de deduplicación real queda a cargo del proveedor final. */
export class FakeMailProvider implements MailProvider {
  supportsStableIdempotency = true;
  readonly accepted = new Map<string, { messageId: string; notice: ReportNotice }>();
  readonly failures: Array<"unavailable" | "accepted_timeout"> = [];
  async send(key: string, notice: ReportNotice): Promise<{ messageId: string }> {
    const existing = this.accepted.get(key);
    if (existing) return { messageId: existing.messageId };
    const fault = this.failures.shift();
    if (fault === "unavailable") throw new ProviderFailure("provider_unavailable", true);
    const messageId = `fake:${key}`;
    this.accepted.set(key, { messageId, notice });
    if (fault === "accepted_timeout") throw new ProviderFailure("acceptance_unknown", true);
    return { messageId };
  }
}
