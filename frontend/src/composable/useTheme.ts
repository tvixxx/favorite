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

// Единый UI-шрифт для Ant-компонентов (совпадает с --fv-font-ui)
const UI_FONT =
  "'Favorite Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const themeConfigs = {
  light: {
    token: {
      colorPrimary: "#ff0032",
      borderRadius: 12,
      colorBgContainer: "#ffffff",
      fontFamily: UI_FONT,
    },
  },
  dark: {
    token: {
      colorPrimary: "#ff3355", // бренд-красный (ярче) — как в theme-variables.scss dark
      fontFamily: UI_FONT,
    },
    algorithm: theme.darkAlgorithm,
  },
  emerald: {
    token: {
      colorPrimary: "#10b981",
      colorBgContainer: "#f0fdf4",
      fontFamily: UI_FONT,
    },
  },
  corporate: {
    token: {
      colorPrimary: "#1e40af",
      borderRadius: 4,
      fontFamily: UI_FONT,
    },
  },
  synthwave: {
    token: {
      colorPrimary: "#ec4899",
      colorBgContainer: "#0f0f23",
      fontFamily: UI_FONT,
    },
    algorithm: theme.darkAlgorithm,
  },
  retro: {
    token: {
      colorPrimary: "#f59e0b",
      borderRadius: 8,
      fontFamily: UI_FONT,
    },
  },
  cyberpunk: {
    token: {
      colorPrimary: "#8b5cf6",
      colorBgContainer: "#1e1b4b",
      fontFamily: UI_FONT,
    },
    algorithm: theme.darkAlgorithm,
  },
} as const;

/* Эталон различает радиусы: кнопки/чипы — 8px (--radius-control), поля — 12px.
   Ant задаёт общий borderRadius на все контролы, поэтому кнопкам нужен точечный override. */
const CONTROL_COMPONENTS = {
  Button: { borderRadius: 8, borderRadiusLG: 8, borderRadiusSM: 8 },
};

/* Выпадашки ant рендерятся в body. Наши оверлеи (модалка, шит фильтров) стоят
   на 9999, поэтому базовый z-index поповеров нужно поднять выше — иначе список
   селекта прячется под затемнением. */
const POPUP_TOKEN = { zIndexPopupBase: 10050 };

export const themeConfig = computed(() => {
  const config = themeConfigs[currentTheme.value];

  return {
    ...config,
    token: { ...config.token, ...POPUP_TOKEN },
    components: CONTROL_COMPONENTS,
  };
});

export type Theme = (typeof themes)[number];

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("app-theme");

  if (stored && (themes as readonly string[]).includes(stored)) {
    return stored as Theme;
  }

  const prefersDark = window.matchMedia?.(
    "(prefers-color-scheme: dark)"
  ).matches;

  return prefersDark ? "dark" : "light";
}

// useStorage применит дефолт только при отсутствии ключа: системная тема
// подхватится лишь на первом заходе, дальше уважается выбор пользователя.
export const currentTheme = useStorage<Theme>("app-theme", getInitialTheme());

export const setTheme = (theme: Theme) => {
  currentTheme.value = theme;
  document.documentElement.setAttribute("data-theme", theme);

  const configuredPrimary = (
    themeConfigs[theme] as { token?: { colorPrimary?: string } }
  )?.token?.colorPrimary;

  // Если у темы есть свой primary в Ant-конфиге — синхронизируем CSS-переменную;
  // иначе снимаем inline-override, чтобы применилось значение из theme-variables.scss.
  if (configuredPrimary) {
    document.documentElement.style.setProperty(
      "--fv-color-brand",
      configuredPrimary
    );
  } else {
    document.documentElement.style.removeProperty("--fv-color-brand");
  }
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
