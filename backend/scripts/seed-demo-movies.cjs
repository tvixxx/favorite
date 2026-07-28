/**
 * Демо-данные для проверки догрузки списков: 10 фильмов/сериалов в каталог
 * и часть из них — в коллекцию указанного пользователя.
 *
 *   node scripts/seed-demo-movies.cjs                 # добавить (по умолчанию test@mail.ru)
 *   node scripts/seed-demo-movies.cjs --email a@b.c   # другому пользователю
 *   node scripts/seed-demo-movies.cjs --remove        # убрать всё добавленное
 *
 * Схему НЕ меняет — это данные, а не миграция. Повторный запуск не плодит дубли:
 * тайтлы ищутся по title_normalized.
 */
const fs = require("fs");
const path = require("path");

const BACKEND_DIR = path.resolve(__dirname, "..");
const { Client } = require(path.join(BACKEND_DIR, "node_modules/pg"));

const DATABASE_URL = fs
  .readFileSync(path.join(BACKEND_DIR, ".env"), "utf8")
  .match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];

const args = process.argv.slice(2);
const REMOVE = args.includes("--remove");
const emailIndex = args.indexOf("--email");
const EMAIL = emailIndex !== -1 ? args[emailIndex + 1] : "test@mail.ru";

/** Помечаем демо-тайтлы в описании — по этой метке их же и удаляем */
const DEMO_MARK = "[demo]";

const MOVIES = [
  { title: "Тихий город", genres: ["DRAMA", "DETECTIVE"], year: 2021, countries: ["US"] },
  { title: "Полночный экспресс", genres: ["THRILLER"], year: 2019, countries: ["GB"] },
  { title: "Северное сияние", genres: ["DRAMA", "ROMANCE"], year: 2022, countries: ["RU"] },
  { title: "Код доступа", genres: ["ACTION", "DETECTIVE"], year: 2023, countries: ["US", "GB"] },
  { title: "Лето в Провансе", genres: ["COMEDY", "FAMILY"], year: 2018, countries: ["FR"] },
  { title: "Пустой этаж", genres: ["HORROR"], year: 2024, countries: ["US"] },
  {
    title: "Гранд-отель",
    genres: ["DRAMA", "COMEDY"],
    year: 2020,
    countries: ["DE"],
    serial: { seasons: 3, episodes: 24 },
  },
  {
    title: "Станция «Заря»",
    genres: ["Sci-fi", "THRILLER"],
    year: 2022,
    countries: ["RU"],
    serial: { seasons: 2, episodes: 16 },
  },
  {
    title: "Дом у озера",
    genres: ["DETECTIVE", "DRAMA"],
    year: 2021,
    countries: ["ES"],
    serial: { seasons: 1, episodes: 8 },
  },
  { title: "Последний рубеж", genres: ["WAR", "DRAMA"], year: 2017, countries: ["US"] },
];

/** Столько демо-тайтлов положим в коллекцию — чтобы кнопка «Показать ещё» появилась */
const IN_COLLECTION = 6;

const normalize = (title) => title.trim().replace(/\s+/g, " ").toLowerCase();

(async () => {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    const { rows: users } = await db.query(
      "SELECT id, email FROM users WHERE email = $1",
      [EMAIL],
    );

    if (!users.length) {
      throw new Error(`Пользователь ${EMAIL} не найден`);
    }

    const userId = users[0].id;

    if (REMOVE) {
      const { rowCount } = await db.query(
        "DELETE FROM movies WHERE description LIKE $1",
        [`%${DEMO_MARK}%`],
      );

      console.log(`Удалено демо-тайтлов: ${rowCount}`);

      return;
    }

    let created = 0;
    let linked = 0;

    for (const [index, movie] of MOVIES.entries()) {
      const titleNormalized = normalize(movie.title);

      const { rows: existing } = await db.query(
        "SELECT id FROM movies WHERE title_normalized = $1",
        [titleNormalized],
      );

      let movieId = existing[0]?.id;

      if (!movieId) {
        const { rows } = await db.query(
          `INSERT INTO movies
             (id, title, title_normalized, description, country_codes, genres,
              publish_date, is_serial, season_count, episode_count, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"enum_genre"[], $6, $7, $8, $9, NOW(), NOW())
           RETURNING id`,
          [
            movie.title,
            titleNormalized,
            `Демо-тайтл для проверки списков. ${DEMO_MARK}`,
            movie.countries,
            movie.genres,
            new Date(`${movie.year}-01-01`),
            Boolean(movie.serial),
            movie.serial?.seasons ?? null,
            movie.serial?.episodes ?? null,
          ],
        );

        movieId = rows[0].id;
        created += 1;
      }

      if (index < IN_COLLECTION) {
        const { rowCount } = await db.query(
          `INSERT INTO user_movies (id, user_id, movie_id, added_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [userId, movieId],
        );

        linked += rowCount;
      }
    }

    const { rows: totals } = await db.query(
      `SELECT (SELECT COUNT(*)::int FROM movies) AS movies,
              (SELECT COUNT(*)::int FROM user_movies WHERE user_id = $1) AS collection`,
      [userId],
    );

    console.log(`Создано тайтлов: ${created}, добавлено в коллекцию: ${linked}`);
    console.log(
      `Теперь в каталоге ${totals[0].movies}, в коллекции ${EMAIL} — ${totals[0].collection}`,
    );
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error("Ошибка:", error.message);
  process.exit(1);
});
