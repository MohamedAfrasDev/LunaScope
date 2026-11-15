import { Term } from "@/components/ui/term";

/** One quiet line under the results: the words the page uses, each with its meaning one press away. */
export function TermsHint() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>Terms used here:</span>
      <Term id="terrain-aware" />
      <Term id="flat-horizon" />
      <Term id="availability-range" />
      <Term id="unresolved" />
      <Term id="excluded" />
    </p>
  );
}
