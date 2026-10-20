# Автодеплой Favkino из main

Подготовленные файлы пока не означают установленный или проверенный CI/CD.
Публикацию workflow, установку на VPS, добавление SSH-ключа и включение
production выполняет оператор поэтапно. Закрытые ключи и токены в чат не отправлять.

## Контракт

- PR в main запускает проверки без production-секретов.
- Push в main запускает проверки, миграции на пустом PostgreSQL 18,
  сборку трёх linux/amd64 образов и публикацию в GHCR.
- Production запускается только при repository variable `DEPLOY_ENABLED=true`.
  До первого успешного прогона проверок и сборки оставить её выключенной.
- Три образа передаются на VPS по digest, не по изменяемому тегу.
- Проверяются актуальный origin/main, чистый checkout main, архитектура
  и метка commit SHA каждого образа.
- Старые задания пропускаются с `DEPLOY_SUPERSEDED`. Новые коммиты,
  пришедшие во время уже начатого обновления, обрабатываются следующим заданием.
- Очередь production не отменяет выполняющийся деплой. Дополнительно
  systemd удерживает общий с бэкапами lock.
- До миграций сохраняются прежние образы и конфигурация, отдельный дамп БД
  и проверенная зашифрованная внешняя копия именно этого дампа.
- Ошибка бэкапа или S3 останавливает обновление до миграций.
- После миграций запускаются API и nginx, проверяются nginx-конфиг, API и веб.
- Автоматического восстановления БД нет. При ошибке нужна проверка
  состояния миграций и ручной выбор действия по RECOVERY.md.

Actions закреплены за SHA, токен публикации имеет `packages:write`,
токен задания деплоя имеет только `contents:read` и `packages:read`.
Production env приложения, S3-ключи и закрытый GPG-ключ в GitHub не передаются.

## Имена пакетов и приватность

Workflow публикует образы в `ghcr.io/tvixxx`:
`favkino-private-backend`, `favkino-private-migrate`, `favkino-private-web`.
Обработчик деплоя скачивает только эти имена по digest.
Имена контейнеров `favorite-backend` и `favorite-web` сохраняются.

Прежние `favorite-backend`, `favorite-migrate`, `favorite-web` оказались
публичными. Этот переход не удаляет и не закрывает их.
Слово `private` в новом имени не задаёт видимость. Для нового пакета GitHub
по умолчанию использует Private, но перед публикацией нужно проверить, что имя
свободно или уже приватное, а после публикации подтвердить Private и связь
с `tvixxx/favorite`. Public обратно в Private не переключается.
Для скачивания приватных образов сохраняется существующий временный
`GITHUB_TOKEN`, постоянный PAT не требуется.

При переходе на новые имена оставить repository variable
`DEPLOY_ENABLED=false` до проверки пакетов и обновления обработчика на VPS.
Установленная root-owned копия `/usr/local/lib/favkino-deploy/receive.cjs`
не обновляется через git pull. Оператор должен отдельно сверить её с прежней
версией, сохранить закрытую резервную копию и установить проверенный новый
`deploy/ci/receive.cjs` с правами `0600 root:root` при неработающем
`favkino-deploy.service`. Затем сверить SHA-256 и выполнить `node --check`.
Entrypoint, sudoers и systemd unit при этой смене имён не меняются.

## Доступ и временные данные

Отдельный SSH-ключ CI добавляется с фиксированной командой:

```text
restrict,command="/usr/bin/sudo -n /usr/local/sbin/favkino-deploy" ssh-ed25519 <PUBLIC_KEY> favkino-ci-20261020
```

Не добавлять этот ключ обычной строкой без ограничений.
Персональный SSH-ключ Mac сохраняется отдельной существующей строкой.
`restrict` запрещает PTY, forwarding и пользовательский SSH rc.
Sudo разрешает без пароля только root-owned entrypoint без аргументов,
без общего NOPASSWD и без включения deploy в docker-группу.

Entrypoint принимает JSON через stdin, проверяет размер и поля.
Краткоживущий GITHUB_TOKEN передаётся по SSH в закрытый файл
`/run/favkino-deploy-request.json` с правами 0600.
Файл удаляется после завершения systemd-сервиса, в том числе при ошибке.
Docker login использует stdin и отдельный root-only RuntimeDirectory.
Каталог удаляется при завершении сервиса. Постоянный PAT на VPS не нужен.

Запрос передаётся systemd, поэтому закрытие SSH не останавливает выполняющийся
деплой. При обрыве связи проверять сервис через личное SSH-подключение,
не останавливать его ради повторного запуска. Зависшее задание не перезаписывается.

Право менять main даёт право менять исполняемые от root deploy-скрипты.
Ограничения CI-ключа не заменяют контроль доступа к main.

## Установка, до включения DEPLOY_ENABLED

1. Создать отдельный Ed25519-ключ на Mac, не перезаписывая существующие файлы.
   Для unattended CI ключ без парольной фразы. Закрытый файл хранить с правами 0600,
   передавать только непосредственно в GitHub environment secret.
2. Передать на VPS четыре файла из `deploy/ci`: `receive.cjs`,
   `favkino-deploy`, `favkino-deploy.service`, `favkino-ci.sudoers`.
   Отдельно передать только открытый ключ `.pub`.
3. Сверить SHA-256 с проверенной локальной версией. Проверить синтаксис
   `node --check receive.cjs`, `bash -n favkino-deploy` и
   `sudo visudo -cf favkino-ci.sudoers`.
4. При отсутствии целевых файлов установить:

```text
/usr/local/lib/favkino-deploy                    0700 root:root
/usr/local/lib/favkino-deploy/receive.cjs        0600 root:root
/usr/local/sbin/favkino-deploy                   0755 root:root
/etc/systemd/system/favkino-deploy.service      0644 root:root
/etc/sudoers.d/favkino-ci                       0440 root:root
```

Не перезаписывать существующие целевые пути без проверки.
Выполнить `sudo systemd-analyze verify /etc/systemd/system/favkino-deploy.service`
и `sudo systemctl daemon-reload`.
Сервис запускается по запросу, отдельный таймер и `enable` ему не нужны.

5. Сохранить закрытую резервную копию существующего authorized_keys.
   Добавить только ограниченную строку CI, проверить права .ssh 0700 и
   authorized_keys 0600. Не закрывать действующее личное SSH-подключение.
6. Получить публичный Ed25519 host key через уже доверенное SSH-подключение
   к VPS и сверить fingerprint. Сформировать known_hosts строку с адресом
   `201.24.62.199`. Не доверять одному ssh-keyscan без сверки.
7. Создать GitHub environment `production`, разрешить deployment только main.
   Добавить environment secret `FAVKINO_SSH_KEY` и environment variable
   `FAVKINO_KNOWN_HOSTS`. В secret помещается только отдельный CI-ключ.
8. Проверить GitHub Actions billing и запретить нежелательные платные превышения.
   GHCR хранение и трафик сейчас бесплатны, минуты Actions зависят от
   публичности репозитория, типа runner и плана аккаунта.
   Workflow не создаёт Actions artifacts или постоянные caches.
9. До первого push проверить имена GHCR-пакетов `favkino-private-backend`,
   `favkino-private-migrate`, `favkino-private-web` владельца tvixxx. Они должны отсутствовать
   или быть приватными. При существующем public-пакете остановиться и отдельно
   согласовать другие имена в workflow и receiver.
   Только после отдельного решения оператора закоммитить и опубликовать код.
   Проверить успешные checks и images при выключенном `DEPLOY_ENABLED`.
   Проверить, что новые GHCR-пакеты приватные и связаны с tvixxx/favorite.
10. Проверить ограниченный SSH-доступ отрицательным запросом `{}`:
    ожидается отказ, production не должен запускаться. Отдельно проверить
    отсутствие PTY и невозможность выполнить произвольную команду этим ключом.
11. После этих проверок установить repository variable `DEPLOY_ENABLED=true`
    и вручную запустить workflow на main. Проверить журнал, HTTPS и вход.
    Дальнейшие push в main будут обновлять production автоматически.

## Проверки и диагностика

Локальные тесты не используют production env или Docker daemon:

```bash
node --test deploy/*.spec.cjs deploy/ci/*.spec.cjs backend/scripts/backup/*.spec.cjs
```

Они проверяют запросы, порядок действий, запрет старых SHA, обработку ошибок,
права временного файла, сохранение текущих данных и ограничения workflow.
Тесты orchestration подменяют команды. Совместимость shell/systemd/sudoers,
первую реальную сборку GHCR и полный deploy проверить на соответствующих этапах.

Через личный SSH:

```bash
sudo systemctl show favkino-deploy.service -p ActiveState -p Result -p ExecMainStatus
sudo journalctl -u favkino-deploy.service -n 80 --no-pager --output=cat
```

Маркеры успеха: `RESTORE_POINT_READY`, `OFFSITE_BACKUP_OK`,
`CI_RELEASE_OK`, `FAVKINO_DEPLOY_OK <SHA>`.
Последний успешный SHA и точка возврата записываются в
`deploy/.state/ci-last-success.json`. Конфигурация образов находится в
`deploy/.state/ci-images.json`, подключается только в CI-сценарии.

## Диск и границы

До скачивания требуется минимум 8 ГиБ свободного места. Перед архивированием
проверяется резерв 3 ГиБ плюс двойной суммарный размер прежних API/web образов,
перед дампом проверяется место с учётом размера БД. Это проверки перед этапами,
а не жёсткая дисковая квота. Образы и points релизов автоматически не удаляются.
Оператор очищает ненужные архивы и образы адресно после проверки точек возврата.
При исчерпании резерва новый деплой остановится. Docker prune в CI не используется.

Обычная ротация почасовых локальных и внешних дампов продолжает работать.
Архивы релизов в backups/releases имеют отдельный срок хранения и не входят
в обычную GFS-ротацию. Максимум внешнего бакета 2 ГБ сохраняется.
Отсутствие места или доступности S3 перед миграцией блокирует новый deploy.

Схема рассчитана на один VPS. Пересоздание backend/web может кратковременно
прервать запросы и Socket.IO. Миграции должны быть совместимы с работающей
старой версией до переключения приложения.

## Первичные источники

- [Публикация Docker-образов](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GHCR и permissions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Стоимость Packages и исключение GHCR](https://docs.github.com/en/billing/concepts/product-billing/github-packages)
- [Очередь Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [Ограничения SSH-ключа](https://man.openbsd.org/sshd.8#AUTHORIZED_KEYS_FILE_FORMAT)
- [Sudoers без аргументов](https://manpages.ubuntu.com/manpages/noble/man5/sudoers.5.html)
- [RuntimeDirectory](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
