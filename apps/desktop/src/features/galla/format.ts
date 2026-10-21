/** "21:10" style time of a timestamp, Indian format ("9:05 pm") */
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
