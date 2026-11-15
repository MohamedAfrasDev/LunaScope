import type { Presentation } from "@/lib/status";
import { Badge } from "./ui/badge";

/** Icon + word + tone. The icon is decorative (the word carries the meaning). */
export function StatusChip({ p, title }: { p: Pick<Presentation, "label" | "icon" | "tone">; title?: string }) {
  return (
    <Badge variant={p.tone} title={title}>
      <span aria-hidden="true">{p.icon}</span>
      {p.label}
    </Badge>
  );
}
