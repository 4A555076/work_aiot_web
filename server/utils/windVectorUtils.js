const { formatTruncateOneDecimal } = require('./formatUtils');
const { findWindModels, getNumericValue, normalizeDirection } = require('./windUtils');

const buildWindVector = (rows, models) => {
  const { directionModel, speedModel } = findWindModels(models);
  if (!directionModel || !speedModel) return null;

  const points = [];

  for (const row of rows) {
    const date = new Date(row.Date_Time || row.DateTime || row.dateTime || row.time);
    const timestamp = date.getTime();
    if (!Number.isFinite(timestamp)) continue;

    const speed = getNumericValue(row[speedModel.value]);
    const direction = getNumericValue(row[directionModel.value]);
    if (speed == null || speed < 0 || direction == null) continue;

    points.push([
      timestamp,
      formatTruncateOneDecimal(speed),
      formatTruncateOneDecimal(normalizeDirection(direction)),
    ]);
  }

  points.sort((left, right) => left[0] - right[0]);
  return { points };
};

module.exports = { buildWindVector };
