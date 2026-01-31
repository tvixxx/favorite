import { computed, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { theme } from "ant-design-vue";

export const themes = [
  "light",
  "dark",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
] as const;

export const themeConfigs = {
  light: {
    token: {
      colorPrimary: "#1677ff",
      borderRadius: 6,
      colorBgContainer: "#ffffff",
    },
  },
  dark: {
    algorithm: theme.darkAlgorithm,
  },
  emerald: {
    token: {
      colorPrimary: "#10b981",
      colorBgContainer: "#f0fdf4",
    },
  },
  corporate: {
    token: {
      colorPrimary: "#1e40af",
      borderRadius: 4,
    },
  },
  synthwave: {
    token: {
      colorPrimary: "#ec4899",
      colorBgContainer: "#0f0f23",
    },
    algorithm: theme.darkAlgorithm,
  },
  retro: {
    token: {
      colorPrimary: "#f59e0b",
      borderRadius: 8,
    },
  },
  cyberpunk: {
    token: {
      colorPrimary: "#8b5cf6",
      colorBgContainer: "#1e1b4b",
    },
    algorithm: theme.darkAlgorithm,
  },
} as const;

export const themeConfig = computed(() => themeConfigs[currentTheme.value]);

export type Theme = (typeof themes)[number];

export const currentTheme = useStorage<Theme>("app-theme", "light");

export const setTheme = (theme: Theme) => {
  currentTheme.value = theme;
  document.documentElement.setAttribute("data-theme", theme);

  document.documentElement.style.setProperty(
    "--ant-color-primary",
    (themeConfigs[theme] as any)?.token?.colorPrimary || "#1677ff"
  );
};

export function useTheme() {
  watch(
    currentTheme,
    (newTheme) => {
      setTheme(newTheme);
    },
    { immediate: true }
  );
}
