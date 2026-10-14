import { fireEvent, screen } from "@testing-library/react";

export function chooseEmployee(selectLabel: string, profileId: string) {
  const trigger = screen.queryByRole("button", { name: selectLabel });
  if (!trigger) {
    fireEvent.change(screen.getByRole("combobox", { name: selectLabel }), { target: { value: profileId } });
    return;
  }
  fireEvent.click(trigger);
  const option = document.querySelector<HTMLElement>(`[role="option"][data-profile-id="${profileId}"]`);
  if (!option) throw new Error(`No se encontró el perfil ${profileId} en el selector abierto.`);
  fireEvent.click(option);
}
