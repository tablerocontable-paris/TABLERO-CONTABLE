import { useState } from "react";
import App from "../App";
import { load, persist } from "../data/repository";
import { prepareLaboratoryInvitation } from "../domain/parameterization";

// The release remains a laboratory until the final version is accepted.
// It never imports the operational workspace or calls its API.
export default function LaboratoryWorkspace() {
  const [initial] = useState(() => {
    let state = load(true);
    const params = new URLSearchParams(location.search);
    const invited = params.get("invitacion");
    if (invited) {
      state = prepareLaboratoryInvitation(state, invited);
      persist(state, true);
      params.delete("invitacion");
      const search = params.toString();
      history.replaceState(
        null,
        "",
        location.pathname + (search ? "?" + search : ""),
      );
    }
    persist(state, true);
    return state;
  });
  return <App initialState={initial} laboratoryMode />;
}
