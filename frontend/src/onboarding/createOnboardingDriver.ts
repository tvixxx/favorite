import { driver, type Config, type Driver } from "driver.js";
import type { Router } from "vue-router";
import { nextTick } from "vue";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePath(router: Router, path: string): Promise<void> {
  const current = router.currentRoute.value.path;

  if (current === path) {
    await nextTick();
    await sleep(220);

    return;
  }

  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const cur =
    current.endsWith("/") && current.length > 1
      ? current.slice(0, -1)
      : current;

  if (cur === normalized || cur.startsWith(`${normalized}/`)) {
    await nextTick();
    await sleep(220);

    return;
  }

  await router.push(path);
  await nextTick();
  await sleep(420);
}

function qs(sel: string): Element | null {
  return document.querySelector(sel);
}

export type OnboardingDriverCallbacks = {
  onCompleted: () => void;
};

/**
 * Интерактивный тур (driver.js): подсветка DOM и переходы по страницам.
 */
export function createOnboardingDriver(
  router: Router,
  callbacks: OnboardingDriverCallbacks,
): Driver {
  let tourRef: Driver | undefined;

  const refreshTourAfterDomLayout = async (): Promise<void> => {
    await nextTick();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

    await sleep(120);
    tourRef?.refresh();
  };

  const baseConfig: Config = {
    showProgress: true,
    animate: true,
    smoothScroll: true,
    stagePadding: 10,
    stageRadius: 12,
    overlayOpacity: 0.58,
    nextBtnText: "Далее",
    prevBtnText: "Назад",
    doneBtnText: "Готово",
    progressText: "{{current}} из {{total}}",
    allowClose: true,
    onHighlighted: () => {
      tourRef?.refresh();
    },
    onDestroyed: () => {
      callbacks.onCompleted();
    },
    steps: [
      {
        popover: {
          title: "Добро пожаловать",
          description:
            "Мы подсветим ключевые места: меню «Медиатека», коллекцию и каталог, друзей и уведомления. Используйте «Далее» или стрелки на клавиатуре.",
          side: "over",
          align: "center",
        },
      },
      {
        element: () =>
          qs('[data-tour="nav-library"]') ?? document.body,
        onHighlightStarted: refreshTourAfterDomLayout,
        popover: {
          title: "Медиатека",
          description:
            "Центральный вход к коллекции, общему каталогу, актёрам и вашим спискам.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: () =>
          qs('[data-tour="tour-quick-add"]') ?? document.body,
        onHighlightStarted: async () => {
          await ensurePath(router, "/library/collection");
        },
        popover: {
          title: "Быстрый ввод",
          description:
            "На странице коллекции добавляйте тайтлы из каталога без долгого поиска.",
          side: "left",
          align: "center",
        },
      },
      {
        element: '[data-tour="collection-filters"]',
        onHighlightStarted: async () => {
          await ensurePath(router, "/library/collection");
        },
        popover: {
          title: "Фильтры и поиск",
          description:
            "Жанры, страны, диапазон оценки и текстовый поиск — чтобы находить нужное в большой коллекции.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="catalog-filters"]',
        onHighlightStarted: async () => {
          await ensurePath(router, "/library/catalog");
        },
        popover: {
          title: "Каталог",
          description:
            "Здесь все фильмы базы. Откройте карточку и добавьте тайтл к себе.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: () =>
          qs('[data-tour="friends-add-btn"]') ?? document.body,
        onHighlightStarted: async () => {
          await ensurePath(router, "/friends");
        },
        popover: {
          title: "Друзья",
          description:
            "Добавление по email: заявка в друзья или подписка без подтверждения.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: () =>
          qs('[data-tour="nav-notifications"]') ?? document.body,
        onHighlightStarted: refreshTourAfterDomLayout,
        popover: {
          title: "Уведомления",
          description:
            "Новые сообщения и заявки подсвечиваются здесь (в реальном времени при открытом приложении).",
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: "На этом всё",
          description:
            "Дальше просто пользуйтесь Favorite. Тур можно закрыть или вернуться к любому шагу кнопкой «Назад».",
          side: "over",
          align: "center",
        },
      },
    ],
  };

  tourRef = driver(baseConfig);

  return tourRef;
}
