// Joins class names, skipping the ones that are off: cn("a", cond && "b").
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
