import { useCallback, useMemo, useState } from "react";

/**
 * Small form state for one settings section: tracks edits against the
 * saved value, validates on save, and lets the user discard changes.
 */
export function useSectionForm<T extends object>(
  saved: T,
  validate: (v: T) => Partial<Record<keyof T, string>>,
) {
  const [draft, setDraft] = useState<T>(saved);
  const [submitted, setSubmitted] = useState(false);
  // When the saved value changes (e.g. reset to defaults), start over from it
  const [base, setBase] = useState<T>(saved);
  if (base !== saved) {
    setBase(saved);
    setDraft(saved);
    setSubmitted(false);
  }

  const errors = useMemo<Partial<Record<keyof T, string>>>(
    () => (submitted ? validate(draft) : {}),
    [submitted, draft, validate],
  );
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const discard = useCallback(() => {
    setDraft(saved);
    setSubmitted(false);
  }, [saved]);

  /** Validates; calls onValid with the draft only when there are no errors */
  const submit = useCallback(
    (onValid: (value: T) => void) => {
      setSubmitted(true);
      if (Object.keys(validate(draft)).length === 0) {
        onValid(draft);
        setSubmitted(false);
        return true;
      }
      return false;
    },
    [draft, validate],
  );

  return { draft, set, errors, dirty, discard, submit };
}
