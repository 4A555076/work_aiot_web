const { formatTruncateOneDecimal } = require('./formatUtils');

const BOXPLOT_TIME_GROUPS = new Set(['hour', 'day', 'week', 'month']);

const getRowDate = (row) =>
  new Date(row.Date_Time || row.DateTime || row.dateTime || row.time);

const pad2 = (value) => String(value).padStart(2, '0');

const formatDate = (date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const getTimeGroupKey = (date, timeGroup) => {
  if (timeGroup === 'hour') return `${formatDate(date)} ${pad2(date.getUTCHours())}:00`;
  if (timeGroup === 'day') return formatDate(date);
  if (timeGroup === 'month') return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;

  // Weeks run from Monday through Sunday.
  const start = new Date(date);
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  start.setUTCDate(date.getUTCDate() - offsetFromMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return `${formatDate(start)}–${formatDate(end)}`;
};

const percentile = (sortedValues, ratio) => {
  const position = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];

  return sortedValues[lowerIndex]
    + (sortedValues[upperIndex] - sortedValues[lowerIndex])
      * (position - lowerIndex);
};

const parseBoxplotOptions = (box = {}) => {
  const timeGroup = box.timeGroup || 'day';
  const rawLower = box.lower == null ? 25 : box.lower;
  const rawUpper = box.upper == null ? 75 : box.upper;
  const lower = Number(rawLower);
  const upper = Number(rawUpper);

  if (
    !BOXPLOT_TIME_GROUPS.has(timeGroup)
    || (typeof rawLower === 'string' && rawLower.trim() === '')
    || (typeof rawUpper === 'string' && rawUpper.trim() === '')
    || !Number.isFinite(lower)
    || !Number.isFinite(upper)
    || lower < 0
    || lower >= 50
    || upper <= 50
    || upper > 100
    || lower >= upper
  ) {
    return null;
  }

  return { timeGroup, lowerRatio: lower / 100, upperRatio: upper / 100 };
};

const buildBoxplots = (rows, models, options) => {
  const datedRows = rows
    .map((row) => ({ row, date: getRowDate(row) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  const boxplots = {};

  for (const model of models) {
    const groups = new Map();

    for (const { row, date } of datedRows) {
      const rawValue = row[model.value];
      if (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === '')) continue;

      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const key = getTimeGroupKey(date, options.timeGroup);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(value);
    }

    const categories = [];
    const data = [];
    const outliers = [];

    for (const [category, sourceValues] of groups.entries()) {
      const categoryIndex = categories.length;
      const values = [...sourceValues].sort((left, right) => left - right);
      const q1 = percentile(values, options.lowerRatio);
      const median = percentile(values, 0.5);
      const q3 = percentile(values, options.upperRatio);
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      const inliers = values.filter((value) => {
        const isInlier = value >= lowerFence && value <= upperFence;
        if (!isInlier) {
          outliers.push([categoryIndex, formatTruncateOneDecimal(value)]);
        }
        return isInlier;
      });

      categories.push(category);
      data.push([
        inliers[0] ?? q1,
        q1,
        median,
        q3,
        inliers[inliers.length - 1] ?? q3,
      ].map((value) => formatTruncateOneDecimal(value)));
    }

    boxplots[model.value] = { categories, data, outliers };
  }

  return boxplots;
};

module.exports = { buildBoxplots, parseBoxplotOptions };
