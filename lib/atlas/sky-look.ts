/**
 * The fixed colours of the Atlas Site sky picture (a lit grey surface under a black sky). They are a look, not theme tokens: the
 * Atlas is always dark, and the diagram view on the run pages keeps drawing from the theme (see lib/sky-palette.ts).
 */
export const PHOTO_LOOK = {
  sky: "#000000",
  wall: "#d8d5cd",
  ridge: "#c9a24d",
  compass: "#9aa0b4",
  sunCore: "#fff6dc",
  light: "#ffffff",
  landerBody: "#c9a24d",
  landerDark: "#2a2c33",
  landerPanel: "#3a3f52",
} as const;
