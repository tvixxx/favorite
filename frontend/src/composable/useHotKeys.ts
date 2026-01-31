import { useMagicKeys, whenever } from "@vueuse/core";
import { setTheme, themes } from "@/composable/useTheme";

export function useHotThemeKeys() {
  const keys = useMagicKeys();

  whenever(keys.ctrl_1, () => setTheme(themes[0]));
  whenever(keys.ctrl_2, () => setTheme(themes[1]));
  whenever(keys.ctrl_3, () => setTheme(themes[2]));
  whenever(keys.ctrl_4, () => setTheme(themes[3]));
  whenever(keys.ctrl_5, () => setTheme(themes[4]));
  whenever(keys.ctrl_6, () => setTheme(themes[5]));
  whenever(keys.ctrl_7, () => setTheme(themes[6]));
}
