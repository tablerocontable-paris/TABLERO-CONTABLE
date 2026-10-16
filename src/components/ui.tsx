import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  className = "",
  restoreFocus = true,
  focusFallback,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  restoreFocus?: boolean | (() => boolean);
  focusFallback?: () => HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restoreFrame = useRef<number | null>(null);
  const cancelRestoreRef = useRef<((frame: number) => void) | null>(null);
  const restoreFocusRef = useRef(restoreFocus);
  const focusFallbackRef = useRef(focusFallback);
  restoreFocusRef.current = restoreFocus;
  focusFallbackRef.current = focusFallback;
  if (opener.current === null && typeof document !== "undefined" && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
  const titleId = useId();
  useEffect(() => {
    const d = ref.current!;
      if (restoreFrame.current !== null) cancelRestoreRef.current?.(restoreFrame.current);
    d.showModal();
    return () => {
      if (d.open) d.close();
      const policy = restoreFocusRef.current;
      const shouldRestore = typeof policy === "function" ? policy() : policy;
      if (!shouldRestore) return;
      const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
      cancelRestoreRef.current = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : window.clearTimeout;
      restoreFrame.current = schedule(() => {
        restoreFrame.current = null;
        const source = opener.current;
        const visible = (node: HTMLElement | null) => {
          if (!node?.isConnected || node.matches(":disabled") || node.closest("[hidden]")) return false;
          for (let current: HTMLElement | null = node; current; current = current.parentElement) {
            const style = getComputedStyle(current);
            if (style.display === "none" || style.visibility === "hidden") return false;
          }
          return true;
        };
        const target = visible(source) ? source : focusFallbackRef.current?.() || null;
        if (visible(target)) target!.focus();
      });
    };
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
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
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
  expanded,
  onExpandedChange,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const bodyId = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = expanded ?? localOpen;
  const changeOpen = (next: boolean) => {
    if (expanded === undefined) setLocalOpen(next);
    onExpandedChange?.(next);
  };
  return (
    <section className={`panel${collapsible ? " panel-collapsible" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {collapsible ? (
          <div className="panel-head-actions">
            {action && <div className="panel-head-action" onClick={() => changeOpen(true)}>{action}</div>}
            <button
              type="button"
              className="icon-button panel-collapse"
              aria-label={`${open ? "Plegar" : "Desplegar"} ${title}`}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => changeOpen(!open)}
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
