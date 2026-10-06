import { type State } from "../domain/model";
import { Panel } from "./ui";

export default function LaboratoryInvitations({ state }: { state: State }) {
  return (
    <Panel
      title="Invitaciones de prueba"
      sub="Probá el primer ingreso con el perfil ya configurado. No envía correos ni habilita cuentas reales."
    >
      <div className="laboratory-invitations">
        {[...state.profiles]
          .filter((p) => p.active)
          .sort((a, b) => Number(b.id === "boss") - Number(a.id === "boss"))
          .map((p) => (
            <div key={p.id}>
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.role} · {p.companyIds.length} empresas · {p.position}
                </small>
              </span>
              <a
                className="button-link"
                href={"?laboratorio=1&invitacion=" + encodeURIComponent(p.id)}
              >
                Probar invitación de {p.name}
              </a>
            </div>
          ))}
      </div>
      <p className="access-note">
        En la versión final, administración define rol, responsable, puesto,
        sucursal, sector y empresas antes de enviar el enlace. Las invitaciones
        reales quedan pendientes hasta aceptar la versión completa.
      </p>
    </Panel>
  );
}
