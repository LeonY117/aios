/** Stubby pointer — shorter, wider, rounded joins. */
const POINTER_PATH =
  "M3 2V17c0 .4.5.6.8.3l3.8-3.8a.5.5 0 0 1 .35-.15H13a.5.5 0 0 0 .4-.8L4.2 1.6A.8.8 0 0 0 3 2z";

const DROP_SHADOW_FILTER = [
  '<defs><filter id="s" x="-30%" y="-30%" width="180%" height="180%">',
  '<feDropShadow dx="0.5" dy="1.2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.35"/>',
  "</filter></defs>",
].join("");

function encodeSvg(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Black stubby pointer, white outline, -15° tilt, soft drop shadow. */
export function buildNormalCursor(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">',
    DROP_SHADOW_FILTER,
    '<g transform="translate(2,2) rotate(-15, 5, 3)" filter="url(#s)">',
    `<path d="${POINTER_PATH}" fill="#111" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`,
    "</g>",
    "</svg>",
  ].join("");
  return `${encodeSvg(svg)} 6 5, auto`;
}

/** Stacked stubby pointers: black front + accent back, -15° tilt, top-right offset, soft drop shadow. */
export function buildAltDragCursor(
  accentFill: string,
  accentStroke: string,
): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 36 32">',
    DROP_SHADOW_FILTER,
    '<g transform="translate(2,2) rotate(-15, 6, 4)" filter="url(#s)">',
    // Back cursor (accent, offset top-right)
    '<g transform="translate(7, 0)">',
    `<path d="${POINTER_PATH}" fill="${accentFill}" stroke="${accentStroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    "</g>",
    // Front cursor (black, offset bottom-left)
    '<g transform="translate(3, 3)">',
    `<path d="${POINTER_PATH}" fill="#111" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`,
    "</g>",
    "</g>",
    "</svg>",
  ].join("");
  return `${encodeSvg(svg)} 7 6, auto`;
}
