import { driver, type Config, type Driver, type DriveStep } from "driver.js";
import type { Router } from "vue-router";
import { nextTick } from "vue";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePath(router: Router, path: string): Promise<void> {
  const current = router.currentRoute.value.path;
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const cur =
    current.endsWith("/") && current.length > 1 ? current.slice(0, -1) : current;

  if (cur === normalized || cur.startsWith(`${normalized}/`)) {
    await nextTick();

    return;
  }

  await router.push(path);
  await nextTick();
  await sleep(320);
}

function qs(...selectors: string[]): Element | null {
  for (const selector of selectors) {
    const found = document.querySelector(selector);

    // Скрытый элемент (например, десктопное меню на мобиле) подсветить нельзя
    if (found instanceof HTMLElement && found.offsetParent !== null) {
      return found;
    }
  }

  return null;
}

export type OnboardingDriverCallbacks = {
  onCompleted: () => void;
};

/**
 * Интерактивный тур (driver.js): подсветка DOM и переходы по страницам.
 *
 * Важное про порядок: driver.js резолвит `element` шага ДО того, как отдаст
 * управление хукам, поэтому маршрут нужно менять в `onNextClick`/`onPrevClick`
 * предыдущего шага — иначе на новой странице элемент ещё не существует и шаг
 * подсвечивает `body`.
 */
export function createOnboardingDriver(
  router: Router,
  callbacks: OnboardingDriverCallbacks,
): Driver {
  // Ждём, пока страница отрисуется, и пересчитываем подсветку
  const settleLayout = async (): Promise<void> => {
    await nextTick();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await sleep(120);
  };

  /** Переход к соседнему шагу с гарантией, что нужная страница уже открыта */
  const moveTo = (path: string | null, move: () => void) => {
    return async (): Promise<void> => {
      if (path) {
        await ensurePath(router, path);
        await settleLayout();
      }

      move();
    };
  };

  const next = (path: string | null) => moveTo(path, () => tourRef.moveNext());
  const prev = (path: string | null) =>
    moveTo(path, () => tourRef.movePrevious());

  const steps: DriveStep[] = [
    {
      popover: {
        title: "Добро пожаловать",
        description:
          "Мы подсветим ключевые места: меню «Медиатека», коллекцию и каталог, друзей и уведомления. Используйте «Далее» или стрелки на клавиатуре.",
        side: "over",
        align: "center",
        onNextClick: next("/library/collection"),
      },
    },
    {
      // На мобиле десктопного меню нет — его роль играет таб-бар
      element: () =>
        qs('[data-tour="nav-library"]', '[data-tour="tab-library"]') ??
        document.body,
      popover: {
        title: "Медиатека",
        description:
          "Центральный вход к коллекции, общему каталогу, актёрам и вашим спискам.",
        align: "center",
        onNextClick: next(null),
        onPrevClick: prev(null),
      },
    },
    {
      element: () => qs('[data-tour="tour-quick-add"]') ?? document.body,
      popover: {
        title: "Быстрый ввод",
        description:
          "На странице коллекции добавляйте тайтлы из каталога без долгого поиска.",
        align: "center",
        onNextClick: next(null),
        onPrevClick: prev(null),
      },
    },
    {
      element: '[data-tour="collection-filters"]',
      popover: {
        title: "Фильтры и поиск",
        description:
          "Жанры, страны, диапазон оценки и текстовый поиск — чтобы находить нужное в большой коллекции.",
        side: "bottom",
        align: "start",
        onNextClick: next("/library/catalog"),
        onPrevClick: prev(null),
      },
    },
    {
      // Шаг про каталог как источник тайтлов — подсвечиваем сами карточки
      element: () =>
        qs('[data-tour="catalog-grid"]', '[data-tour="catalog-filters"]') ??
        document.body,
      popover: {
        title: "Каталог",
        description:
          "Здесь все фильмы базы. Откройте карточку и добавьте тайтл к себе.",
        side: "top",
        align: "center",
        onNextClick: next("/friends"),
        onPrevClick: prev("/library/collection"),
      },
    },
    {
      element: () => qs('[data-tour="friends-add-btn"]') ?? document.body,
      popover: {
        title: "Друзья",
        description:
          "Добавление по email: заявка в друзья или подписка без подтверждения.",
        side: "bottom",
        align: "end",
        onNextClick: next(null),
        onPrevClick: prev("/library/catalog"),
      },
    },
    {
      element: () =>
        qs('[data-tour="nav-notifications"]', '[data-tour="tab-social"]') ??
        document.body,
      popover: {
        title: "Уведомления",
        description:
          "Новые сообщения и заявки подсвечиваются здесь (в реальном времени при открытом приложении).",
        side: "bottom",
        align: "end",
        onNextClick: next(null),
        onPrevClick: prev(null),
      },
    },
    {
      popover: {
        title: "На этом всё",
        description:
          "Дальше просто пользуйтесь Favorite. Тур можно закрыть или вернуться к любому шагу кнопкой «Назад».",
        side: "over",
        align: "center",
        onPrevClick: prev(null),
      },
    },
  ];

  const baseConfig: Config = {
    showProgress: true,
    animate: true,
    smoothScroll: true,
    // Эталон: подсветка плотно по элементу, скругление 14, маска темнее
    stagePadding: 6,
    stageRadius: 14,
    overlayColor: "#0c101a",
    overlayOpacity: 0.6,
    popoverClass: "fv-tour",
    nextBtnText: "Далее",
    prevBtnText: "Назад",
    doneBtnText: "Готово",
    progressText: "{{current}} из {{total}}",
    allowClose: true,
    onDestroyed: () => {
      callbacks.onCompleted();
    },
    steps,
  };

  const tourRef = driver(baseConfig);

  return tourRef;
}
