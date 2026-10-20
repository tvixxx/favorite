# Внешние копии Favkino

Подготовленный этап для существующего `favkino-db-backup.service` типа
`oneshot`. Установка и первый запуск на production выполняются оператором.
Скрипт не создаёт таймер и не подтверждает, что production уже настроен.

## Порядок работы

1. Существующий этап создаёт и ротирует локальные дампы.
2. `db-offsite.cjs` выбирает последний готовый дамп `favorite-*.dump`.
3. Проверяет закрытые права каталогов и файла учётных данных, резерв диска
   3 ГиБ плюс место для шифрования и проверочного скачивания.
4. Шифрует на открытый ключ, отправляет под новым случайным именем в
   `s3://favkino-backups/db/`, скачивает файл обратно и сверяет SHA-256.
5. Проверяет сохранённые в S3 metadata контрольные суммы исходного дампа и
   шифротекста, затем собирает все страницы списка объектов.
6. Только после этого ротирует внешние копии: все за 24 часа, затем последние
   доступные 7 дней, 4 недели и 3 месяца. Длительный перерыв не удаляет все
   сохранившиеся копии. Алгоритм общий с локальной ротацией.
7. Удаляет собственный временный каталог. Исходный локальный дамп сохраняется.

Ротация касается только ключей формата
`db/favorite-YYYY-MM-DDTHHMMZ-<16 hex>-<16 hex>.dump.gpg`.
Объекты в `verification/` и чужие имена не удаляются.
При ошибке до начала ротации прежние объекты не удаляются.
Если удаление отдельного старого объекта завершилось ошибкой, уже удалённые
старые объекты не возвращаются, новая проверенная копия остаётся.

Скрипт закреплён за текущей инфраструктурой Favkino:
endpoint `https://s3.twcstorage.ru`, регион `ru-1`, приватный бакет
`favkino-backups`, открытый ключ
`071B3507C032D951A28CED18ED66422BEFCBD333`.
AWS CLI запускается из уже загруженного образа по digest, с `--pull never`.
Файл учётных данных подключается только для чтения. Контейнеру доступен
временный каталог с шифротекстом, каталог с исходными дампами не подключается.

## Файлы на VPS

- `/srv/favorite/backups` — локальные дампы, `0700 root:root`.
- `/etc/favkino-backup/s3-credentials` — отдельный S3-пользователь, `0600 root:root`.
- `/etc/favkino-backup/gnupg` — только открытый ключ, `0700 root:root`.
- `/usr/local/lib/favkino-backup/db-offsite.cjs` и `retention.cjs` —
  установленные оператором копии кода, `0600 root:root`.
- `/etc/systemd/system/favkino-db-backup.service.d/20-offsite.conf` —
  второй `ExecStart` после локального бэкапа.

Закрытый ключ и парольная фраза на VPS не нужны.
При замене ключа нужно проверить восстановление, изменить закреплённый
fingerprint и переустановить скрипт.

## Установка после передачи файлов

Сначала сравнить SHA-256 трёх переданных файлов с проверенной локальной
версией. Команды ниже предполагают, что они лежат в
`/home/deploy/favkino-offsite-setup-20261020`.
При существующих целевых файлах остановиться и проверить их, не перезаписывать.

В SSH на VPS:

```bash
(
  set -eu
  stage=/home/deploy/favkino-offsite-setup-20261020
  sudo test ! -e /usr/local/lib/favkino-backup
  sudo test ! -L /usr/local/lib/favkino-backup
  sudo test ! -e /etc/systemd/system/favkino-db-backup.service.d/20-offsite.conf
  sudo test ! -L /etc/systemd/system/favkino-db-backup.service.d/20-offsite.conf
  node --check "$stage/db-offsite.cjs"
  node --check "$stage/retention.cjs"
  sudo install -d -o root -g root -m 0700 /usr/local/lib/favkino-backup
  sudo install -o root -g root -m 0600 \
    "$stage/db-offsite.cjs" "$stage/retention.cjs" /usr/local/lib/favkino-backup/
  sudo flock --close -w 900 /run/lock/favkino-deploy-backup.lock \
    /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    /usr/bin/node /usr/local/lib/favkino-backup/db-offsite.cjs
)
```

Ожидается `OFFSITE_BACKUP_OK`. При ошибке сохранить вывод и выяснить причину.
До успешного реального запуска не подключать этап к таймеру.

После успешного запуска проверить текущий unit через
`sudo systemctl cat favkino-db-backup.service`.
В нём должен быть один существующий `ExecStart` с локальным `db-backup.cjs`,
тип `oneshot` и прежняя проверка свободного места.

```bash
(
  set -eu
  stage=/home/deploy/favkino-offsite-setup-20261020
  target=/etc/systemd/system/favkino-db-backup.service.d/20-offsite.conf
  sudo test ! -e "$target"
  sudo test ! -L "$target"
  sudo install -o root -g root -m 0644 "$stage/20-offsite.conf" "$target"
  sudo systemd-analyze verify /etc/systemd/system/favkino-db-backup.service
  sudo systemctl daemon-reload
  sudo systemctl start favkino-db-backup.service
  sudo systemctl show favkino-db-backup.service -p Result -p ExecMainStatus
  sudo systemctl is-enabled favkino-db-backup.timer
  sudo systemctl is-active favkino-db-backup.timer
  sudo journalctl -u favkino-db-backup.service -n 40 --no-pager
)
```

Ожидаются `Result=success`, `ExecMainStatus=0`, `enabled`, `active` и
`OFFSITE_BACKUP_OK`. Затем отдельно проверить запись успешного запуска
по расписанию. Успешный ручной запуск не подтверждает срабатывание таймера.

Оба этапа используют общий lock, но захватывают его отдельно. Второй этап
выбирает последний готовый дамп уже под блокировкой. Для `oneshot` systemd
выполняет команды последовательно и не запускает второй этап при ошибке
первого. `flock --close` не передаёт дескриптор блокировки дочернему GPG-agent.

Для отключения только внешнего этапа переместить `20-offsite.conf` вне файлов
с расширением `.conf`, затем выполнить `sudo systemctl daemon-reload`.
Локальный этап и существующий таймер сохраняются.

## Ограничения и восстановление

Максимум бакета 2 ГБ управляется в панели Timeweb, скрипт его не меняет.
Если места не хватит для новой копии, выгрузка завершится ошибкой. Старые
копии до успешной проверки новой не удаляются, нужен ручной контроль объёма.
Проверочное скачивание каждой копии создаёт исходящий трафик S3.
Ротация не является жёстким ограничением количества или суммарного размера.

Пользователь S3 имеет чтение, запись, список и удаление для этого бакета.
При компрометации VPS его ключ позволяет удалить внешние копии.
Object Lock и отдельная независимая копия этим изменением не настраиваются.

В metadata каждого объекта сохраняются `plain-sha256` и `cipher-sha256`.
Для восстановления скачать выбранный объект, проверить шифротекст,
расшифровать на доверенном компьютере и сравнить SHA-256 дампа.
После этого выполнить проверку восстановления во временную базу.
Прежний ручной объект в `verification/` не имеет этих metadata,
его контрольные суммы были проверены оператором отдельно.

Тесты используют временные каталоги и подменяют GPG/Docker.
Они проверяют порядок операций, сохранность локальных и предыдущих внешних
копий при сбоях, права, запас места и обработку страниц S3:

```bash
node --test backend/scripts/backup/backup.spec.cjs backend/scripts/backup/offsite.spec.cjs
```

Реальная совместимость metadata, выгрузки и запуска systemd проверяется
после установки на VPS. Оповещения о пропущенных бэкапах пока не настроены.
