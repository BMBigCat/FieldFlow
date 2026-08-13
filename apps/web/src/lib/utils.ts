import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui class-merging helper, wired up ahead of the first component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
