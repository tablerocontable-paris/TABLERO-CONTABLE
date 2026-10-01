/** Se crea sólo en servidor con cliente service_role. Nunca exponer ese cliente al navegador. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ClaimedDelivery, DeliveryErrorCode, DeliveryStore } from "./report-delivery";
const deliverySchema = z.object({
  id: z.string().uuid(), report_id: z.string().uuid(),
  recipient_email: z.email(), lease_token: z.string().uuid(),
});
export function createSupabaseReportStore(client: SupabaseClient): DeliveryStore {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(`RPC de entregas falló: ${name}`);
    return data;
  }
  return {
    async claim(limit) {
      const data = await call("claim_report_deliveries", { p_limit: limit });
      return z.array(deliverySchema).parse(data);
    },
    async complete(delivery: ClaimedDelivery, messageId: string) {
      await call("complete_report_delivery", { p_delivery: delivery.id, p_lease: delivery.lease_token, p_provider_message: messageId });
    },
    async fail(delivery: ClaimedDelivery, code: DeliveryErrorCode, retryable: boolean) {
      await call("fail_report_delivery", { p_delivery: delivery.id, p_lease: delivery.lease_token, p_error_code: code, p_retryable: retryable });
    },
  };
}
