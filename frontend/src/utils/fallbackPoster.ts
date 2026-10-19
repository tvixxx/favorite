import type { Theme } from "@/composable/useTheme";

const scenes = [
  '<circle cx="244" cy="91" r="42" fill="ACCENT"/><path d="M0 320 98 140 178 302 238 214 320 342V480H0Z" fill="LAND"/><path d="m0 359 101-69 82 56 137-47v181H0Z" fill="DEEP"/>',
  '<circle cx="72" cy="88" r="35" fill="ACCENT"/><path d="M0 250q80-30 160 0t160 0v230H0Z" fill="LAND"/><path d="M222 140h34l12 165h-58Z" fill="ACCENT"/><path d="M212 128h54v20h-54Z" fill="DEEP"/><path d="M0 325q70-28 150 0t170 0v155H0Z" fill="DEEP"/>',
  '<circle cx="244" cy="85" r="36" fill="ACCENT"/><path d="M0 260h25V180h48v90h25V120h53v140h24V200h48v60h25V155h48v105h24v220H0Z" fill="LAND"/><path d="M0 330h55v-45h40v45h65v-65h52v65h108v150H0Z" fill="DEEP"/>',
  '<circle cx="228" cy="96" r="43" fill="ACCENT"/><path d="M0 286Q100 150 320 250v230H0Z" fill="LAND"/><path d="M0 315q130 95 320-30v195H0Z" fill="DEEP"/><path d="M0 375q150-70 320-12v117H0Z" fill="LAND"/>',
  '<circle cx="160" cy="192" r="93" fill="LAND"/><ellipse cx="160" cy="192" rx="146" ry="34" transform="rotate(-25 160 192)" fill="none" stroke="ACCENT" stroke-width="14"/><circle cx="61" cy="74" r="7" fill="ACCENT"/><circle cx="267" cy="306" r="10" fill="ACCENT"/><circle cx="257" cy="67" r="5" fill="ACCENT"/>',
  '<circle cx="248" cy="86" r="38" fill="ACCENT"/><path d="m30 330 47-130 47 130Zm85 0 60-190 60 190Zm106 0 38-113 38 113Z" fill="LAND"/><path d="m-25 380 72-175 72 175Zm95 0 65-146 65 146Zm120 0 65-180 65 180Z" fill="DEEP"/>',
  '<path d="M58 380V170a102 102 0 0 1 204 0v210Z" fill="LAND"/><path d="M95 380V175a65 65 0 0 1 130 0v205Z" fill="ACCENT"/><path d="M110 325h100v18H110Zm-15 24h130v18H95Zm-15 24h160v18H80Z" fill="DEEP"/>',
  '<circle cx="79" cy="79" r="33" fill="ACCENT"/><path d="M0 160 80 235 130 380H0Zm320-20-95 98-40 142h135Z" fill="LAND"/><path d="m117 150 69 0-22 75 30 70-59 85h-44l64-88-17-69Z" fill="ACCENT"/><path d="M0 325 80 290l55 90H0Zm320-20-67 10-68 65h135Z" fill="DEEP"/>',
  '<circle cx="225" cy="112" r="65" fill="ACCENT"/><circle cx="249" cy="92" r="57" fill="SKY"/><path d="M0 250q30-55 70-20 45-80 95 0 40-25 65 20Z" fill="LAND"/><path d="M90 330q30-45 70-20 45-70 95 0 40-20 65 20Z" fill="DEEP"/>',
  '<rect x="47" y="70" width="165" height="230" rx="82" fill="LAND"/><circle cx="229" cy="288" r="72" fill="ACCENT"/><path d="m25 368 95-175 95 175Z" fill="DEEP"/><rect x="247" y="64" width="26" height="144" rx="13" fill="ACCENT"/>',
];

export function fallbackPosterSvg(
  seed: string,
  theme: Theme | string = "light"
): string {
  let hash = 2166136261;

  for (const char of seed)
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;

  const hues: Record<string, number> = {
    light: 192,
    dark: 205,
    emerald: 150,
    corporate: 220,
    synthwave: 306,
    retro: 35,
    cyberpunk: 265,
  };
  const hue =
    (hues[theme] ?? hues.light) +
    [-32, -12, 0, 18, 36][Math.floor(hash / 10) % 5];
  const dark = ["dark", "synthwave", "cyberpunk"].includes(theme);
  const color = (h: number, saturation: number, lightness: number): string => {
    const l = lightness / 100;
    const a = (saturation / 100) * Math.min(l, 1 - l);
    const channel = (n: number): string => {
      const k = (n + (((h % 360) + 360) % 360) / 30) % 12;

      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, "0");
    };

    return `#${channel(0)}${channel(8)}${channel(4)}`;
  };

  const colors: Record<string, string> = {
    SKY: color(hue, 18, dark ? 34 : 65),
    LAND: color(hue + 8, 22, dark ? 23 : 36),
    DEEP: color(hue + 6, 28, dark ? 13 : 20),
    ACCENT: color(hue - 15, 23, dark ? 70 : 83),
  };
  const scene = scenes[hash % scenes.length].replace(
    /SKY|LAND|DEEP|ACCENT/g,
    (key) => colors[key]
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480"><rect width="320" height="480" fill="${
    colors.SKY
  }"/>${scene}<rect y="376" width="320" height="104" fill="${color(
    hue,
    30,
    12
  )}"/></svg>`;
}
