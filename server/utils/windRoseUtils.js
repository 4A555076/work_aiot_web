const { formatTruncateOneDecimal } = require('./formatUtils');
const { findWindModels, getNumericValue, normalizeDirection } = require('./windUtils');

const SPEED_BINS = [
  { name: '< 0.3 m/s', min: 0, max: 0.3 },
  { name: '0.3–0.5 m/s', min: 0.3, max: 0.5 },
  { name: '0.5–1 m/s', min: 0.5, max: 1 },
  { name: '1–1.5 m/s', min: 1, max: 1.5 },
  { name: '1.5–2 m/s', min: 1.5, max: 2 },
  { name: '2–3 m/s', min: 2, max: 3 },
  { name: '3–5 m/s', min: 3, max: 5 },
  { name: '5–7 m/s', min: 5, max: 7 },
  { name: '7–9 m/s', min: 7, max: 9 },
  { name: '≥ 9 m/s', min: 9, max: Infinity },
];

const buildWindRose = (rows, models) => {
  const { directionModel, speedModel } = findWindModels(models);
  if (!directionModel || !speedModel) return null;

  const points = [];

  for (const row of rows) {
    const date = new Date(row.Date_Time || row.DateTime || row.dateTime || row.time);
    if (Number.isNaN(date.getTime())) continue;

    const speed = getNumericValue(row[speedModel.value]);
    const direction = getNumericValue(row[directionModel.value]);
    if (speed == null || speed < 0 || direction == null) continue;

    points.push({ speed, direction: normalizeDirection(direction) });
  }

  const speedBuckets = Array.from({ length: 8 }, () => []);
  const distribution = SPEED_BINS.map(({ name }) => ({ name, data: Array(16).fill(0) }));

  for (const { speed, direction } of points) {
    const roseDirectionIndex = Math.round(direction / 45) % 8;
    const distributionDirectionIndex = Math.round(direction / 22.5) % 16;
    speedBuckets[roseDirectionIndex].push(speed);

    const speedBinIndex = SPEED_BINS.findIndex(
      ({ min, max }) => speed >= min && speed < max,
    );
    distribution[speedBinIndex].data[distributionDirectionIndex] += 1;
  }

  const rose = speedBuckets.map((speeds) => {
    if (!speeds.length) return 0;
    const totalSpeed = speeds.reduce((sum, speed) => sum + speed, 0);
    return formatTruncateOneDecimal(totalSpeed / speeds.length);
  });

  return { rose, distribution, total: points.length };
};

module.exports = { buildWindRose };
