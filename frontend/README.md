# favourite

## Project setup

```
npm install
```

### Compiles and hot-reloads for development

```
npm run serve
```

### Compiles and minifies for production

```
npm run build
```

### Run your unit tests

```
npm run test:unit
```

### Lints and fixes files

```
npm run lint
```

Автоисправление стиля (в т.ч. пустые строки перед `return` и после `block-like` по правилам ESLint):

```
npm run lint:fix
```

Конфиг: `eslint.config.mjs` (flat config, ESLint 10). Старый `.eslintrc.js` сохранён как `.eslintrc.legacy.js.bak`.

### Customize configuration

См. [Vite](https://vitejs.dev/config/) и [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files).

### Идеи на потом

- Внешние рейтинги (IMDb / Кинопоиск) — не делаем: нестабильные источники данных для КП и лишняя сложность; при необходимости можно вернуться к обсуждению позже.
