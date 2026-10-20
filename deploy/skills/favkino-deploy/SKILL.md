---
name: favkino-deploy
description: Деплой FavouriteApp на favkino.ru и проверка результата. Используй для явного запроса «задеплой FavouriteApp», «деплой фаворит» или $favkino-deploy. Проверка статуса остаётся чтением.
---

# Деплой FavouriteApp

Штатный вызов разрешает один production-деплой опубликованного main без повторного вопроса о подтверждении. Он не разрешает commit/push, изменение секретов, включение выключенного DEPLOY_ENABLED, прямой SSH, покупки, очистку Docker или восстановление БД.

## Постоянный контекст

- Checkout: /Users/kashilov1/Downloads/customProj/favourite-app.
- GitHub: tvixxx/favorite. Ветка: main. Workflow: ci-deploy.yml.
- Production environment: production. Repository variable: DEPLOY_ENABLED, ожидается true.
- Сайт: https://favkino.ru. API: https://favkino.ru/api/health. VPS: 201.24.62.199.
- GHCR: ghcr.io/tvixxx/favkino-private-backend, favkino-private-migrate, favkino-private-web.
- Workflow сам проверяет код, собирает linux/amd64, передаёт digests через ограниченный CI SSH-key и запускает favkino-deploy.service.
- До миграций обязательны архив прежних образов/config, dump и проверенная зашифрованная копия этого dump в приватном favkino-backups. Общий lock сериализует deploy и backups.
- Серверные файлы: /srv/favorite/deploy/.state/ci-last-success.json, /srv/favorite/backups/releases/<point>/point.json.
- GHCR storage и release archives не очищаются этим skill. Нехватка места или ошибка backup останавливает deploy.
- Этот контекст достаточен для штатного запуска. Полную историю Memory/TASK_STATE читать только при расхождении или отдельном запросе. Подробности по необходимости: checkout/deploy/CI_CD.md и RECOVERY.md.

## Выполнение

1. Проверь доступность gh и `gh auth status --hostname github.com`. Не выводи токен и не читай credential-файлы. Если CLI отсутствует или нет авторизации, остановись и сообщи точный блокер. Установку/авторизацию согласовать отдельно, затем браузерный вход через `gh auth login --hostname github.com --web`. Не менять git credential helper автоматически.
2. Через `git -C <checkout>` проверь root, origin, HEAD и status. Origin должен быть tvixxx/favorite. Не делать fetch/pull/switch. При локальных изменениях или отличии HEAD от remote main не коммить их и не выдавай старый main за новые изменения. Уточни, нужно ли деплоить уже опубликованный main.
3. Получи текущий целевой SHA: `gh api repos/tvixxx/favorite/commits/main --jq .sha`. Прочитай `gh api repos/tvixxx/favorite/actions/variables/DEPLOY_ENABLED --jq .value`. Если флаг не true или недоступен, остановись. Не обходи выключение автоматики.
4. Проверь последние запуски: `gh run list --repo tvixxx/favorite --workflow ci-deploy.yml --branch main --limit 20 --json databaseId,headSha,status,conclusion,event,createdAt,url`. Если уже выполняется/ожидает запуск того же SHA, наблюдай его, не создавай второй. Если этот SHA уже имеет успешный deploy, проверь его журнал и HTTPS, повторный деплой делай только по явному запросу повторить.
5. Если нового запуска действительно нет, зафиксируй UTC-время и выполни ОДИН раз: `gh workflow run ci-deploy.yml --repo tvixxx/favorite --ref main`. Найди новый workflow_dispatch по ожидаемому SHA и времени после отправки. Сохрани run ID/URL в контексте. При неоднозначном ответе dispatch сначала проверь список запусков, не повторяй POST вслепую.
6. Наблюдай `gh run view <ID> --repo tvixxx/favorite --json status,conclusion,headSha,jobs,url`. При отсутствии subscription делай короткие проверки раз в 45–60 секунд, без долгого блокирующего watch. Не отменяй выполняющиеся миграции. Изменение main, DEPLOY_SUPERSEDED, skipped/cancelled/failure у deploy не считать выполнением целевого деплоя. Автоматически новый run не запускать.
7. После success получи журнал deploy через `gh run view <ID> --repo tvixxx/favorite --job <DEPLOY_JOB_ID> --log`. Проверяй RESTORE_POINT_READY, OFFSITE_BACKUP_OK, CI_RELEASE_OK <SHA>, FAVKINO_DEPLOY_OK <SHA> и порядок backup до миграций. Выводи только нужные маркеры, point и безопасную причину ошибки, не весь журнал с окружением. Если нужные строки обрезаны, прямо укажи неполноту и запроси read-only journal VPS. Не выдавай прошлые почасовые копии за pre-migration backup этого run.
8. Проверь curl с обычной проверкой TLS: GET /api/health → HTTP200 и JSON status=ok, GET / → 200, HTTP / → 301 на https://favkino.ru/. При проблеме DNS/VPN допустима диагностическая проверка с --resolve favkino.ru:443:201.24.62.199, это отметить. Не использовать -k и не менять DNS/VPN.
9. Итог: Green только если deploy целевого SHA и внешние проверки успешны, а backup подтверждён журналом. Укажи SHA, run URL, point и фактические проверки. Вход, коллекцию и админку не объявляй проверенными без ручного подтверждения или отдельной авторизованной UI-проверки.

## Ошибки и границы

При ошибке остановись, прочитай только относящиеся к ней annotations/logs и сообщи стадию: до миграций, миграции, переключение или health. Не запускать rollback, повторный deploy, миграции, package install или изменение VPS автоматически. Правки кода и повторный выпуск требуют отдельного запроса.

Если gh/инструмент запрещён текущими permissions, сообщи конкретный запрет, не обходи его другим интерпретатором. Skill задаёт порядок и использует уже настроенный доступ, но не предоставляет права сам по себе.

Источники команд: https://cli.github.com/manual/gh_workflow_run и https://cli.github.com/manual/gh_run_view.
