const REPORT_TIME_TYPES = new Set(['T01', 'T05', 'T60']);

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeModelTypes = (value) => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map(normalizeString).filter(Boolean))];
};

const parseDateTime = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const timestamp = Date.parse(normalized.replace(' ', 'T'));
  return Number.isFinite(timestamp) ? { value: normalized, timestamp } : null;
};

const validationError = (fieldErrors) => ({
  ok: false,
  status: 400,
  response: {
    success: false,
    code: 'INVALID_REPORT_FILTERS',
    message: '報表查詢條件不完整或無效。',
    fieldErrors,
  },
});

const validateDashboardReportRequest = (
  body,
  { source = 'station', reportType },
) => {
  const payload = body && typeof body === 'object' ? body : {};
  const fieldErrors = {};
  const PJID = normalizeString(payload.PJID);
  const STID = normalizeString(payload.STID);
  const start = parseDateTime(payload.startDateTime);
  const end = parseDateTime(payload.endDateTime);
  const modelTypes = normalizeModelTypes(payload.modelTypes);
  const modelType = normalizeString(payload.modelType);

  if (source === 'station' && !PJID) fieldErrors.PJID = 'PJID 為必填欄位。';
  if (!STID) fieldErrors.STID = 'STID 為必填欄位。';
  if (!start) fieldErrors.startDateTime = '請提供有效的開始時間。';
  if (!end) fieldErrors.endDateTime = '請提供有效的結束時間。';
  if (start && end && start.timestamp > end.timestamp) {
    fieldErrors.endDateTime = '結束時間不可早於開始時間。';
  }
  if (reportType === 'daily' && !modelType) {
    fieldErrors.modelType = '日報表必須選擇一個測項。';
  }

  const requestedTimeType = normalizeString(payload.timeType);
  const timeType = source === 'epa' || reportType === 'daily'
    ? 'T60'
    : requestedTimeType;

  if (reportType === 'data' && !REPORT_TIME_TYPES.has(timeType)) {
    fieldErrors.timeType = '時間類型僅支援 T01、T05 或 T60。';
  }

  if (Object.keys(fieldErrors).length) return validationError(fieldErrors);

  return {
    ok: true,
    value: {
      PJID,
      STID,
      startDateTime: start.value,
      endDateTime: end.value,
      timeType,
      modelType,
      modelTypes,
      flagOnly: payload.flagOnly === true,
    },
  };
};

const createDashboardReportResponse = (data, context) => ({
  success: true,
  data,
  meta: {
    reportType: context.reportType,
    source: context.source,
    rowCount: Array.isArray(data) ? data.length : 0,
    generatedAt: new Date().toISOString(),
    appliedFilters: context.filters,
  },
});

module.exports = {
  createDashboardReportResponse,
  validateDashboardReportRequest,
};
