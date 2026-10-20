function parseStamp(fileName) {
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})Z/);

  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00Z`) : null;
}

/**
 * Ротация «дед-отец-сын»: держим все дампы за последние KEEP_HOURLY часов,
 * затем по одному (самому свежему) на день, неделю и месяц.
 */
function pickKeepers(files, limits, now = Date.now()) {
  const keep = new Set();
  const newestPer = new Map();

  const dated = files
    .map((name) => ({ name, at: parseStamp(name) }))
    .filter((f) => f.at)
    .sort((a, b) => b.at - a.at);

  for (const file of dated) {
    const ageHours = (now - file.at.getTime()) / 36e5;

    if (ageHours <= limits.hourly) {
      keep.add(file.name);
    }

    const iso = file.at.toISOString();
    const day = iso.slice(0, 10);
    const month = iso.slice(0, 7);
    // Номер недели считаем от эпохи — достаточно, чтобы группировать по 7 дней
    const week = Math.floor(file.at.getTime() / (7 * 864e5));

    for (const [bucket, key, limit] of [
      ['day', day, limits.daily],
      ['week', week, limits.weekly],
      ['month', month, limits.monthly],
    ]) {
      const seen = newestPer.get(bucket) ?? new Map();

      if (!seen.has(key) && seen.size < limit) {
        seen.set(key, file.name);
        keep.add(file.name);
      }

      newestPer.set(bucket, seen);
    }
  }

  return keep;
}

module.exports = { parseStamp, pickKeepers };
