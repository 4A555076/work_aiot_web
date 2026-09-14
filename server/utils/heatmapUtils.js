const { formatTruncateOneDecimal } = require('./formatUtils');

const getRowDate = (row) =>
  new Date(row.Date_Time || row.DateTime || row.dateTime || row.time);

const formatDay = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const buildHeatmaps = (rows, models) => {
  const datedRows = rows
    .map((row) => ({ row, date: getRowDate(row) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  const heatmaps = {};

  for (const model of models) {
    const groups = new Map();

    for (const { row, date } of datedRows) {
      const rawValue = row[model.value];
      if (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === '')) continue;

      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const day = formatDay(date);
      const hour = date.getUTCHours();
      const key = `${day}::${hour}`;
      if (!groups.has(key)) groups.set(key, { day, hour, total: 0, count: 0 });

      const group = groups.get(key);
      group.total += value;
      group.count += 1;
    }

    const days = [...new Set([...groups.values()].map(({ day }) => day))].sort();
    const dayIndexes = new Map(days.map((day, index) => [day, index]));
    const data = [...groups.values()]
      .sort((left, right) => left.day.localeCompare(right.day) || left.hour - right.hour)
      .map(({ day, hour, total, count }) => [
        dayIndexes.get(day),
        hour,
        formatTruncateOneDecimal(total / count),
      ]);

    heatmaps[model.value] = { days, data };
  }

  return heatmaps;
};

module.exports = { buildHeatmaps };
