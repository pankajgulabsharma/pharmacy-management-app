import type { ComponentProps, MouseEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { openNativePicker } from "@/lib/dom";

type Props = Omit<ComponentProps<"input">, "type">;

/**
 * Date field that opens the calendar when the user clicks anywhere on it,
 * not only on the small calendar icon.
 */
export function DateInput({ className, onClick, ...props }: Props) {
  const handleClick = (e: MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented && !props.disabled && !props.readOnly) {
      openNativePicker(e.currentTarget);
    }
  };

  return (
    <Input
      type="date"
      {...props}
      onClick={handleClick}
      className={cn("cursor-pointer", className)}
    />
  );
}
