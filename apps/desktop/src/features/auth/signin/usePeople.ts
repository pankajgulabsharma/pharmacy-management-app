import { useCallback, useEffect, useState } from "react";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { apiGet } from "@/lib/api";

type State =
  | { status: "loading" }
  | { status: "ready"; shop: string; people: SignInPerson[] }
  | { status: "offline" };

/** The sign-in tiles (asked from the main computer — works on every counter) */
export function usePeople() {
  const [state, setState] = useState<State>({ status: "loading" });
  const fetchPeople = useCallback(
    () =>
      apiGet<{ shop: string; people: SignInPerson[] }>("/api/auth/people").then(
        (r) => setState({ status: "ready", ...r }),
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
