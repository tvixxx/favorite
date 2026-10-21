import { driver, type Driver, type DriveStep } from "driver.js";
import { nextTick } from "vue";
import type { Router } from "vue-router";

type TourStep = {
  title: string;
  description: string;
  path?: string;
  selector?: string;
  settings?: boolean;
};

function visibleElement(selector?: string): HTMLElement | undefined {
  if (!selector) return;

  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (element) =>
      element.getClientRects().length > 0 &&
      !element.closest('[aria-busy="true"]')
  );
}

function waitForElement(
  selector: string,
  signal: AbortSignal
): Promise<HTMLElement | undefined> {
  const found = visibleElement(selector);

  if (found || signal.aborted) return Promise.resolve(found);

  return new Promise((resolve) => {
    const finish = (): void => {
      observer.disconnect();
      signal.removeEventListener("abort", finish);
      resolve(visibleElement(selector));
    };
    const observer = new MutationObserver(() => {
      if (visibleElement(selector)) finish();
    });

    signal.addEventListener("abort", finish, { once: true });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

async function waitForImages(
  element: HTMLElement,
  signal: AbortSignal
): Promise<void> {
  await Promise.all(
    [...element.querySelectorAll("img")].map((image) => {
      if (image.complete || signal.aborted) return;

      return new Promise<void>((resolve) => {
        const finish = (): void => {
          image.removeEventListener("load", finish);
          image.removeEventListener("error", finish);
          signal.removeEventListener("abort", finish);
          resolve();
        };

        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        signal.addEventListener("abort", finish, { once: true });
      });
    })
  );
}

export async function settleLayout(): Promise<void> {
  await nextTick();

  const elements = document.querySelectorAll<HTMLElement>(
    ".modal-backdrop, .profile-settings-modal"
  );

  await Promise.all(
    [...elements].flatMap((element) =>
      (element.getAnimations?.() ?? [])
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

export type OnboardingDriverCallbacks = { onCompleted: () => void };

export function createOnboardingDriver(
  router: Router,
  callbacks: OnboardingDriverCallbacks
): Driver {
  const lifecycle = new AbortController();
  let moving = false;
  let openedSettings = false;
  const steps: TourStep[] = [
    {
      title: "Добро пожаловать",
      description:
        "Покажем, как добавлять фильмы и сериалы, вести коллекцию, общаться с друзьями и настроить приложение.",
    },
    {
      title: "Медиатека",
      description:
        "Здесь ваша коллекция, каталог, актёры, списки и дневник просмотров.",
      path: "/library/collection",
      selector: '[data-tour="nav-library"], [data-tour="tab-library"]',
    },
    {
      title: "Добавить произведение",
      description:
        "Кнопка «+» открывает поиск произведения и ручное создание. Уже существующий фильм можно добавить к себе прямо из каталога.",
      path: "/library/collection",
      selector: '[data-tour="create-movie"]',
    },
    {
      title: "Поиск и статусы просмотра",
      description:
        "Ищите по названию и переключайтесь между «Буду смотреть», «Смотрю» и «Просмотрено». Кнопка «Фильтры» открывает остальные условия.",
      path: "/library/collection",
      selector: '[data-tour="collection-filters"] .collection-filters__row',
    },
    {
      title: "Каталог произведений",
      description:
        "Откройте карточку фильма или сериала, чтобы узнать о нём больше и добавить в свою коллекцию.",
      path: "/library/catalog",
      selector:
        '[data-tour="catalog-grid"] > :first-child, [data-tour="catalog-empty"]',
    },
    {
      title: "Найти друзей",
      description:
        "Нажмите «Добавить друга». Найдите человека по имени, нику или почте, выберите его и отправьте заявку.",
      path: "/friends",
      selector: '[data-tour="friends-add-btn"]',
    },
    {
      title: "Уведомления",
      description:
        "Колокольчик показывает до пяти непрочитанных событий. Нажатие открывает событие, полная история доступна по ссылке внутри.",
      path: "/friends",
      selector: '[data-tour="nav-notifications"]',
    },
    {
      title: "Настройки профиля",
      description:
        "Здесь имя, уникальный ник, часовой пояс и персональные настройки. Сейчас посмотрим их по отдельности.",
      path: "/profile",
      selector: '[data-tour="profile-settings"]',
    },
    {
      title: "Быстрый ввод",
      description:
        "Дополнительная кнопка в коллекции помогает быстро найти фильм или сериал в <strong>каталоге</strong> и добавить к себе. Можно скрыть её этим переключателем.",
      path: "/profile",
      settings: true,
      selector: '[data-tour="setting-quickAddEnabled"]',
    },
    {
      title: "Что посмотреть сегодня",
      description:
        "Включите, чтобы приложение предлагало ещё не начатые произведения из вашей коллекции «Буду смотреть».",
      path: "/profile",
      settings: true,
      selector: '[data-tour="setting-watchTonightEnabled"]',
    },
    {
      title: "Импорт и экспорт",
      description:
        "Включите работу с файлами: перенос коллекции из CSV или JSON, скачивание данных и печать PDF.",
      path: "/profile",
      settings: true,
      selector: '[data-tour="setting-collectionFilesEnabled"]',
    },
    {
      title: "Какие уведомления показывать",
      description:
        "Выберите, нужны ли уведомления о сообщениях и заявках в друзья. Настройки сохраняются сразу для вашего аккаунта.",
      path: "/profile",
      settings: true,
      selector: '[data-tour="notification-settings"]',
    },
    {
      title: "Готово",
      description:
        "Добавьте первое произведение или откройте коллекцию. Повторить этот тур можно через меню аккаунта → Помощь.",
      path: "/profile",
    },
  ];

  const closeSettings = (): void => {
    if (openedSettings)
      visibleElement(".profile-settings-modal .modal__close")?.click();
    openedSettings = false;
  };

  const go = async (index: number): Promise<void> => {
    if (moving || lifecycle.signal.aborted) return;
    if (index >= steps.length) {
      tour.destroy();

      return;
    }

    const step = steps[index];

    if (!step) return;
    moving = true;
    document.body.classList.add("fv-tour-transitioning");
    try {
      if (!step.settings) closeSettings();
      if (step.path && router.currentRoute.value.path !== step.path)
        await router.push(step.path);
      await settleLayout();
      if (lifecycle.signal.aborted) return;
      if (step.settings && !visibleElement(".profile-settings-modal")) {
        visibleElement('[data-tour="profile-settings"]')?.click();
        openedSettings = true;
        await settleLayout();
      }

      const element = step.selector
        ? await waitForElement(step.selector, lifecycle.signal)
        : undefined;

      if (lifecycle.signal.aborted) return;
      if (element && !element.closest(".topbar, .mobile-tabbar")) {
        element.scrollIntoView({ block: "center", behavior: "instant" });
        await waitForImages(element, lifecycle.signal);
        await settleLayout();
      }

      if (!lifecycle.signal.aborted) tour.moveTo(index);
    } catch {
      document.body.classList.remove("fv-tour-transitioning");
      tour.destroy();
    } finally {
      moving = false;
    }
  };

  const driveSteps: DriveStep[] = steps.map((step) => ({
    element: step.selector
      ? () => visibleElement(step.selector) ?? document.body
      : undefined,
    popover: {
      title: step.title,
      description: step.description,
      align: "center",
      onNextClick: () => {
        void go((tour.getActiveIndex() ?? 0) + 1);
      },
      onPrevClick: () => {
        void go((tour.getActiveIndex() ?? 0) - 1);
      },
    },
  }));
  const tour = driver({
    steps: driveSteps,
    showProgress: true,
    animate: false,
    smoothScroll: false,
    stagePadding: 6,
    stageRadius: 14,
    onHighlightStarted: (element, _step, { driver }) => {
      driver.setConfig({
        ...driver.getConfig(),
        stageRadius: element?.matches(".collection-filters__row") ? 0 : 14,
      });
    },
    onHighlighted: () => {
      if (!moving) document.body.classList.remove("fv-tour-transitioning");
    },
    overlayColor: "#0c101a",
    overlayOpacity: 0.6,
    popoverClass: "fv-tour",
    nextBtnText: "Далее",
    prevBtnText: "Назад",
    doneBtnText: "Готово",
    progressText: "{{current}} из {{total}}",
    onDestroyed: () => {
      document.body.classList.remove("fv-tour-transitioning");
      lifecycle.abort();
      closeSettings();
      callbacks.onCompleted();
    },
  });

  return tour;
}
