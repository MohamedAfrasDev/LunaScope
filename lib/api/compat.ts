/**
 * Compile-time drift guard. The UI relies on stricter shapes than the generated schema states
 * (for example "this array has no nulls"), so these types stay hand-written. `Sub<A, B>` is A when
 * every key of A exists in B with an assignable type, and `never` for any key that does not. So each
 * assignment below stops compiling when a hand-written field is removed or renamed in the service's
 * schema, or its type changes incompatibly. Fields the UI does not use may be absent from A. Only one level deep: nested records
 * (site and target results) are not compared, so those stay covered by the service tests. Nothing here runs.
 */
import type { components } from "./generated";
import type { CountdownResponse, HorizonProfileResponse, Metrics, ResultsResponse } from "./types";

type S = components["schemas"];
type Sub<A, B> = { [K in keyof A]: K extends keyof B ? (A[K] extends B[K] ? A[K] : never) : never };

export const metricsFitSchema = (x: Metrics): Sub<Metrics, S["MetricsResponse"]> => x;
export const horizonFitsSchema = (x: HorizonProfileResponse): Sub<HorizonProfileResponse, S["HorizonResponse"]> => x;
export const countdownFitsSchema = (x: CountdownResponse): Sub<CountdownResponse, S["CountdownResponse"]> => x;
// Results are checked one level deep: the nested site and target records are not (see the note above).
type ResultsTop = Omit<ResultsResponse, "sites">;
export const resultsFitSchema = (x: ResultsTop): Sub<ResultsTop, S["ResultsResponse"]> => x;
