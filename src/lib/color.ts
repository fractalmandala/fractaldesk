// WCAG 2.1 relative luminance and contrast, used for the live readouts.
export function lum(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}

export function ratio(a: string, b: string): number {
  const l1 = lum(a), l2 = lum(b)
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

export const isHex = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v)

export const grade = (r: number): string => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : 'under AA')

/* ---------------------------------------------------------------- models -- */

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v))

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')

export const toRgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export const fromRgb = (rgb: number[]): string => ('#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2])).toUpperCase()

/** HSV for the picking surface: h 0..360, s/v 0..1. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = toRgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][
    Math.floor((h % 360) / 60)
  ]
  return fromRgb(t.map((n) => (n + m) * 255))
}

/* OKLCH — perceptual lightness, so a ramp built by stepping L reads evenly.
   sRGB <-> OKLab per Björn Ottosson's published matrices. */

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const toGamma = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = toRgb(hex).map((c) => toLinear(c / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: H }
}

function oklchToRgb(L: number, C: number, H: number): number[] {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

const inGamut = (rgb: number[]): boolean => rgb.every((c) => c >= -0.0001 && c <= 1.0001)

/** OKLCH to hex, reducing chroma until the colour fits sRGB rather than clipping
    channels — clipping shifts hue, which is exactly what you notice on a ramp. */
export function oklchToHex(L: number, C: number, H: number): string {
  let lo = 0
  let hi = C
  if (inGamut(oklchToRgb(L, C, H))) lo = C
  else {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToRgb(L, mid, H))) lo = mid
      else hi = mid
    }
  }
  return fromRgb(oklchToRgb(clamp(L), lo, H).map((c) => toGamma(clamp(c)) * 255))
}

/** Step perceptual lightness while holding chroma and hue. */
export function stepLightness(hex: string, delta: number): string {
  const { l, c, h } = hexToOklch(hex)
  return oklchToHex(clamp(l + delta), c, h)
}
