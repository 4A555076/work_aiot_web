const getNumericValue = (rawValue) => {
  if (rawValue == null || (typeof rawValue === 'string' && rawValue.trim() === '')) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
};

const findWindModels = (models) => {
  let directionModel = null;
  let speedModel = null;

  for (const model of models) {
    const description = `${model.name || ''} ${model.label || ''}`;
    if (!directionModel && /(^|\b)WD\b|風向/i.test(description)) directionModel = model;
    if (!speedModel && /(^|\b)WS\b|風速/i.test(description)) speedModel = model;
  }

  return { directionModel, speedModel };
};

const normalizeDirection = (direction) => ((direction % 360) + 360) % 360;

module.exports = { findWindModels, getNumericValue, normalizeDirection };
