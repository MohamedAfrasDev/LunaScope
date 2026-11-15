import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 1280
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

/** True on a phone-width screen. The server render and the first client render say false, so they agree. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
