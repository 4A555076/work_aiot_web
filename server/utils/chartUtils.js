const {
  formatTruncateDecimal,
  formatDate 
} = require('../utils/commonUtils');
const { SPEED_MAP } = require('../constants');


/**
 * 將歷史資料轉換為折線圖資料。
 * @param {Array} data - 原始歷史資料
 * @param {Array} models - 測項設定清單
 * @param {number} decimalPlaces - 小數位數，預設 1
 * @returns {{ line: Object, rows: Array }} 折線圖與歷史資料
 */
function formatLineData(data, models, decimalPlaces = 1) {

  const rows = data.sort(
    (a, b) => new Date(a.Date_Time) - new Date(b.Date_Time)
  );

  const line = Object.fromEntries(
    models.map(({ value }) => [value, []])
  );

  for (const row of rows) {
    const timestamp = new Date(row.Date_Time).getTime();

    for (const { value } of models) {
      const rawValue = row[value];

      if (rawValue == null || rawValue === '') continue;

      const num = Number(rawValue);
      if (!Number.isFinite(num)) continue;

      line[value].push([
        timestamp,
        formatTruncateDecimal(num, decimalPlaces),
      ]);
    }
  }

  return { line, rows };
}


/**
 * 解析並驗證盒鬚圖設定參數。
 * @param {Object} box - 盒鬚圖設定
 * @param {string} box.timeGroup - 時間分組（hour、day、week、month）
 * @param {number|string} box.lower - 下百分位數，預設 25
 * @param {number|string} box.upper - 上百分位數，預設 75
 * @returns {{ timeGroup: string, lowerRatio: number, upperRatio: number }|null} 盒鬚圖設定，驗證失敗回傳 null
 */
const parseBoxplotOptions = ({ timeGroup = 'day', lower = 25, upper = 75 } = {}) => {
  if (
    !['hour', 'day', 'week', 'month'].includes(timeGroup) ||
    [lower, upper].some((v) => v === null || String(v).trim() === '') ||
    !Number.isFinite(Number(lower)) ||
    !Number.isFinite(Number(upper)) ||
    Number(lower) < 0 ||
    Number(lower) >= 50 ||
    Number(upper) <= 50 ||
    Number(upper) > 100
  ) {
    return null;
  }

  return {
    timeGroup,
    lowerRatio: Number(lower) / 100,
    upperRatio: Number(upper) / 100,
  };
};



/**
 * 將歷史資料轉換為盒鬚圖資料。
 * @param {Array} data - 原始歷史資料
 * @param {Array} models - 測項設定清單
 * @param {Object} options - 盒鬚圖設定
 * @param {string} options.timeGroup - 時間分組
 * @param {number} options.lowerRatio - 下百分位比例
 * @param {number} options.upperRatio - 上百分位比例
 * @returns {{ boxplots: Object }} 盒鬚圖資料
 */
const formatBoxplotData = (data, models, { timeGroup, lowerRatio, upperRatio }) => {

  const getGroupKey = (date) => {
    if (timeGroup === 'hour') {
      return formatDate(date, 'yyyy-MM-dd HH:00', true);
    }

    if (timeGroup === 'day') {
      return formatDate(date, 'yyyy-MM-dd', true);
    }

    if (timeGroup === 'month') {
      return formatDate(date, 'yyyy-MM', true);
    }

    // 每週：週一至週日
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);

    return `${formatDate(start, 'yyyy-MM-dd', true)}-${formatDate(end, 'yyyy-MM-dd', true)}`;
  };

  const percentile = (values, ratio) => {
    const position = (values.length - 1) * ratio;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);

    return values[lowerIndex] +
      (values[upperIndex] - values[lowerIndex]) * (position - lowerIndex);
  };

  const datedRows = data
    .map((row) => ({
      row,
      date: new Date(row.Date_Time),
    }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const boxplots = {};

  // 依測項分別產生盒鬚圖
  for (const { value: modelKey } of models) {
    const groups = new Map();

    // 過濾無效數值，並依時間分組
    for (const { row, date } of datedRows) {
      const rawValue = row[modelKey];

      if (rawValue == null || String(rawValue).trim() === '') continue;

      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const groupKey = getGroupKey(date);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey).push(value);
    }

    const categories = [];
    const data = [];
    const outliers = [];

    // 逐組計算盒鬚圖統計數值
    for (const [category, values] of groups) {
      const groupIndex = categories.length;
      const sortedValues = [...values].sort((a, b) => a - b);

      const q1 = percentile(sortedValues, lowerRatio);
      const median = percentile(sortedValues, 0.5);
      const q3 = percentile(sortedValues, upperRatio);

      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      // 分離正常值與離群值
      const inliers = [];

      for (const value of sortedValues) {
        if (value < lowerFence || value > upperFence) {
          outliers.push([groupIndex, formatTruncateDecimal(value, 1, false)]);
        } else {
          inliers.push(value);
        }
      }

      // 組合盒鬚圖五數摘要
      const boxplotValues = [
        inliers[0] ?? q1,
        q1,
        median,
        q3,
        inliers.at(-1) ?? q3,
      ];

      categories.push(category);
      data.push(
        boxplotValues.map((value) =>
          formatTruncateDecimal(value, 1, false)
        )
      );
    }

    boxplots[modelKey] = {
      categories,
      data,
      outliers,
    };
  }

  return { boxplots };
};




/**
 * 將歷史資料轉換為熱點圖資料，依日期及小時分組計算平均值。
 * @param {Array} rows - 原始歷史資料
 * @param {Array} models - 測項設定清單
 * @param {number} decimalPlaces - 小數位數，預設 1
 * @returns {Object} 各測項的熱力圖資料，包含日期清單及每小時平均值
 */
const formatHeatmapData = (rows, models, decimalPlaces = 1) => {

  const datedRows = rows
    .map((row) => ({
      row,
      date: new Date(row.Date_Time),
    }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const heatmaps = {};

  // 依測項分別產生熱點圖
  for (const { value: modelKey } of models) {
    const groups = new Map();

    for (const { row, date } of datedRows) {
      const rawValue = row[modelKey];

      if (rawValue == null || String(rawValue).trim() === '') continue;

      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const day = formatDate(date, 'yyyy-MM-dd');
      const hour = date.getUTCHours();
      const groupKey = `${day}::${hour}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          day,
          hour,
          total: 0,
          count: 0,
        });
      }

      const group = groups.get(groupKey);
      group.total += value;
      group.count++;
    }

    // 取得日期清單，並建立日期對應索引
    const days = [...new Set(
      [...groups.values()].map(({ day }) => day)
    )].sort();

    const dayIndexes = new Map(
      days.map((day, index) => [day, index])
    );

    // 計算各日期及小時的平均值
    const data = [...groups.values()]
      .sort((a, b) =>
        a.day.localeCompare(b.day) || a.hour - b.hour
      )
      .map(({ day, hour, total, count }) => {
        const average = total / count;

        return [
          dayIndexes.get(day),
          hour,
          formatTruncateDecimal(average, decimalPlaces, false),
        ];
      });

    heatmaps[modelKey] = { 
      days, 
      data 
    };
  }

  return heatmaps;
};



/**
 * 取得風向及風速測項。
 * @param {Array} models - 測項設定清單
 * @returns {{ directionModel: Object|null, speedModel: Object|null }} 風向及風速測項
 */
const findWindModels = (models) => {
  let directionModel = null;
  let speedModel = null;

  for (const model of models) {
    const description = `${model.name || ''} ${model.label || ''}`;

    if (!directionModel && /(^|\b)WD\b|風向/i.test(description)) {
      directionModel = model;
    }

    if (!speedModel && /(^|\b)WS\b|風速/i.test(description)) {
      speedModel = model;
    }

    if (directionModel && speedModel) break;
  }

  return { directionModel, speedModel };
};

/**
 * 將歷史資料轉換為風瑰圖資料。
 * @param {Array} rows - 原始歷史資料
 * @param {Array} models - 測項設定清單
 * @returns {{ rose: Array, distribution: Array, total: number }|null} 風瑰圖資料
 */
const formatWindRoseData = (rows, models) => {
  const { directionModel, speedModel } = findWindModels(models);
  if (!directionModel || !speedModel) return null;

  const points = [];

  for (const row of rows) {
    if (row.Date_Time == null || row.Date_Time === '') continue;

    const timestamp = new Date(row.Date_Time).getTime();
    if (!Number.isFinite(timestamp)) continue;

    const rawSpeed = row[speedModel.value];
    const rawDirection = row[directionModel.value];

    if (
      rawSpeed == null || 
      String(rawSpeed).trim() === '' ||
      rawDirection == null || 
      String(rawDirection).trim() === ''
    ) {
      continue;
    }

    const speed = Number(rawSpeed);
    const direction = Number(rawDirection);

    if (
      !Number.isFinite(speed) || 
      speed < 0 || 
      !Number.isFinite(direction)
    ) {
      continue;
    }

    points.push({
      speed,
      direction: ((direction % 360) + 360) % 360,
    });
  }

  // 初始化八方位風速分組與十個風速級距
  const speedBuckets = Array.from({ length: 8 }, () => []);
  const speedBins = Object.values(SPEED_MAP);

  const distribution = speedBins.map(({ name }) => ({
    name,
    data: Array(16).fill(0),
  }));

  // 依風向及風速級距統計資料
  for (const { speed, direction } of points) {
    const roseIndex = Math.round(direction / 45) % 8;
    const directionIndex = Math.round(direction / 22.5) % 16;

    speedBuckets[roseIndex].push(speed);

    const speedBinIndex = speedBins.findIndex(
      ({ min, max }) => speed >= min && speed < max
    );

    if (speedBinIndex !== -1) {
      distribution[speedBinIndex].data[directionIndex]++;
    }
  }

  // 計算各風向的平均風速
  const rose = speedBuckets.map((speeds) => {
    if (speeds.length === 0) return 0;

    const totalSpeed = speeds.reduce((sum, speed) => sum + speed, 0);

    const averageSpeed = totalSpeed / speeds.length;

    return formatTruncateDecimal(averageSpeed, 1, false);
  });

  return {
    rose,
    distribution,
    total: points.length,
  };
};

/**
 * 將歷史資料轉換為風向風速向量圖資料。
 * @param {Array} rows - 原始歷史資料
 * @param {Array} models - 測項設定清單
 * @returns {{ points: Array }|null} 風向風速向量資料
 */
const formatWindVectorData = (rows, models) => {
  const { directionModel, speedModel } = findWindModels(models);
  if (!directionModel || !speedModel) return null;

  const points = [];

  for (const row of rows) {
    if (row.Date_Time == null || row.Date_Time === '') continue;

    const timestamp = new Date(row.Date_Time).getTime();
    if (!Number.isFinite(timestamp)) continue;

    const rawSpeed = row[speedModel.value];
    const rawDirection = row[directionModel.value];

    if (
      rawSpeed == null || 
      String(rawSpeed).trim() === '' ||
      rawDirection == null || 
      String(rawDirection).trim() === ''
    ) {
      continue;
    }

    const speed = Number(rawSpeed);
    const direction = Number(rawDirection);

    if (
      !Number.isFinite(speed) || 
      speed < 0 ||
      !Number.isFinite(direction)
    ) {
      continue;
    }

    // 格式化為 [時間戳記, 風速, 風向]
    points.push([
      timestamp,
      formatTruncateDecimal(speed, 1, false),
      formatTruncateDecimal(((direction % 360) + 360) % 360, 1, false),
    ]);
  }

  // 3. 依時間升冪排序
  points.sort((a, b) => a[0] - b[0]);

  return { points };
};



module.exports = {
  formatLineData,
  parseBoxplotOptions,
  formatBoxplotData,
  formatHeatmapData,
  formatWindRoseData,
  formatWindVectorData
};
