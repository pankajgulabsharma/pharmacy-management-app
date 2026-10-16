import { useCallback, useEffect, useState } from "react";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { apiGet } from "@/lib/api";

type State =
  | { status: "loading" }
  | {
      status: "ready";
      shop: string;
      people: SignInPerson[];
      /** Brand-new shop: one-screen setup instead of the tiles */
      setup: boolean;
    }
  | { status: "offline" };

/** The sign-in tiles (asked from the main computer — works on every counter) */
export function usePeople() {
  const [state, setState] = useState<State>({ status: "loading" });
  const fetchPeople = useCallback(
    () =>
      apiGet<{ shop: string; people: SignInPerson[]; setup?: boolean }>(
        "/api/auth/people",
      ).then(
        (r) => setState({ status: "ready", ...r, setup: r.setup === true }),
        () => setState({ status: "offline" }),
      ),
    [],
  );
  useEffect(() => void fetchPeople(), [fetchPeople]);
  const retry = () => {
    setState({ status: "loading" });
    void fetchPeople();
  };
  return { ...state, retry };
}
