-- Если делали только `prisma db push` (миграция SQL не выполнялась), один раз выполните в БД:
UPDATE "movies"
SET "title_normalized" = lower(regexp_replace(trim(title), '\s+', ' ', 'g'));
