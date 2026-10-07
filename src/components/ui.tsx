import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[wide && "wide", className].filter(Boolean).join(" ")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Cerrar" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Panel({
  title,
  sub,
  children,
  action,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`panel${collapsible ? " panel-collapsible" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {collapsible ? (
          <div className="panel-head-actions">
            {action}
            <button
              type="button"
              className="icon-button panel-collapse"
              aria-label={`${open ? "Plegar" : "Desplegar"} ${title}`}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        ) : action}
      </div>
      {collapsible ? (
        <div id={bodyId} className="panel-body" hidden={!open}>
          {children}
        </div>
      ) : children}
    </section>
  );
}
export function Empty({
  text = "No hay datos para esta selección.",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
export function Meter({ value }: { value: number }) {
  return (
    <div className="track">
      <span
        style={{
          transform: `scaleX(${Math.max(0, Math.min(1, value / 100))})`,
        }}
      />
    </div>
  );
}
