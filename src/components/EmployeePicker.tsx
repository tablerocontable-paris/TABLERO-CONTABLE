import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Profile, Team } from "../domain/model";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es-AR");
}

export default function EmployeePicker({
  label,
  selectLabel = label,
  profiles,
  teams,
  value,
  onChange,
  emptyLabel,
  compact = false,
}: {
  label: string;
  selectLabel?: string;
  profiles: Profile[];
  teams: Team[];
  value: string;
  onChange: (profileId: string) => void;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(value);
  const selected = profiles.find((profile) => profile.id === value);
  const grouped = useMemo(() => {
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("es-AR");
    const matches = profiles.filter((profile) => {
      const teamName = teams.find((team) => team.id === profile.teamId)?.name || "Dirección";
      const searchable = `${profile.name} ${profile.role} ${teamName} ${profile.sector}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es-AR");
      return !normalized || searchable.includes(normalized);
    });
    const groups = [
      ...teams.map((team, index) => ({
        id: team.id,
        label: team.name,
        tone: index % 4,
        profiles: matches.filter((profile) => profile.teamId === team.id),
      })),
      {
        id: "__unassigned__",
        label: "Dirección y otros",
        tone: teams.length % 4,
        profiles: matches.filter((profile) => !teams.some((team) => team.id === profile.teamId)),
      },
    ];
    return groups.filter((group) => group.profiles.length > 0);
  }, [profiles, query, teams]);
  const visibleProfiles = grouped.flatMap((group) => group.profiles);
  const teamLabel = selected
    ? teams.find((team) => team.id === selected.teamId)?.name || selected.sector
    : "";
  const optionId = (profileId: string) => `${id}-option-${profileId}`;

  useEffect(() => {
    if (!open || !activeId) return;
    const option = document.getElementById(optionId(activeId));
    const list = option?.closest<HTMLElement>(".employee-picker-listbox");
    if (!option || !list) return;
    const optionRect = option.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    if (optionRect.top < listRect.top) list.scrollTop -= listRect.top - optionRect.top;
    else if (optionRect.bottom > listRect.bottom) list.scrollTop += optionRect.bottom - listRect.bottom;
  }, [activeId, open]);

  useEffect(() => {
    if (open) {
      setActiveId(visibleProfiles.find((profile) => profile.id === value)?.id || visibleProfiles[0]?.id || "");
      searchRef.current?.focus();
    }
  }, [open, value]);

  useEffect(() => {
    if (open && !visibleProfiles.some((profile) => profile.id === activeId)) {
      setActiveId(visibleProfiles.find((profile) => profile.id === value)?.id || visibleProfiles[0]?.id || "");
    }
  }, [activeId, open, value, visibleProfiles]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(profileId: string) {
    onChange(profileId);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function moveActive(direction: 1 | -1) {
    if (!visibleProfiles.length) return;
    const index = visibleProfiles.findIndex((profile) => profile.id === activeId);
    const next = index < 0
      ? direction > 0 ? 0 : visibleProfiles.length - 1
      : (index + direction + visibleProfiles.length) % visibleProfiles.length;
    setActiveId(visibleProfiles[next]!.id);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home" && visibleProfiles.length) {
      event.preventDefault();
      setActiveId(visibleProfiles[0]!.id);
    } else if (event.key === "End" && visibleProfiles.length) {
      event.preventDefault();
      setActiveId(visibleProfiles.at(-1)!.id);
    } else if (event.key === "Enter" && activeId) {
      event.preventDefault();
      choose(activeId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => {
        if (element.closest("[hidden]") || element.matches(":disabled")) return false;
        for (let current: HTMLElement | null = element; current; current = current.parentElement) {
          const style = getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") return false;
        }
        return true;
      });
      const currentIndex = candidates.indexOf(searchRef.current!);
      let next: HTMLElement | undefined;
      if (event.shiftKey) {
        next = triggerRef.current || undefined;
      } else {
        let nextIndex = currentIndex + 1;
        while (nextIndex < candidates.length && rootRef.current?.contains(candidates[nextIndex])) nextIndex++;
        next = candidates[nextIndex];
      }
      setOpen(false);
      setQuery("");
      window.setTimeout(() => next?.focus(), 0);
    }
  }

  return (
    <div ref={rootRef} className={`employee-picker${compact ? " employee-picker-compact" : ""}`}>
      <label className="employee-picker-select">
        <span>{label}</span>
        <button
          ref={triggerRef}
          type="button"
          className="employee-picker-trigger"
          aria-label={selectLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {selected ? (
            <>
              <span className="employee-picker-avatar" data-tone={Math.max(0, teams.findIndex((team) => team.id === selected.teamId)) % 4} aria-hidden="true">{initials(selected.name)}</span>
              <span className="employee-picker-trigger-copy"><b>{selected.name}</b><small>{selected.role} · {teamLabel}</small></span>
            </>
          ) : <span className="employee-picker-trigger-empty">{emptyLabel || "Elegí una persona"}</span>}
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </label>
      {open && (
        <div className="employee-picker-popover">
          <label className="employee-picker-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              role="combobox"
              aria-label={`Buscar persona en ${label}`}
              aria-expanded="true"
              aria-controls={`${id}-listbox`}
              aria-activedescendant={activeId ? optionId(activeId) : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Nombre, equipo o sector"
            />
          </label>
          <div id={`${id}-listbox`} role="listbox" aria-label={selectLabel} className="employee-picker-listbox">
            {grouped.map((group) => (
              <div key={group.id} role="group" className="employee-picker-group" data-tone={group.tone} aria-label={group.label}>
                <h3>{group.label}</h3>
                {group.profiles.map((profile) => (
                  <div
                    key={profile.id}
                    id={optionId(profile.id)}
                    data-profile-id={profile.id}
                    role="option"
                    aria-label={`${initials(profile.name)} ${profile.name} ${profile.role} · ${profile.sector}`}
                    aria-selected={profile.id === value}
                    data-active={profile.id === activeId}
                    data-tone={group.tone}
                    onMouseMove={() => setActiveId(profile.id)}
                    onClick={() => choose(profile.id)}
                  >
                    <span className="employee-picker-avatar" aria-hidden="true">{initials(profile.name)}</span>
                    <span className="employee-picker-option-copy"><b>{profile.name}</b><small>{profile.role} · {profile.sector}</small></span>
                    {profile.id === value && <span className="employee-picker-current-mark">Actual</span>}
                  </div>
                ))}
              </div>
            ))}
            {!visibleProfiles.length && <p className="employee-picker-empty">No encontramos personas para esa búsqueda.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
