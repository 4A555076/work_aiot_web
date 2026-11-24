import api from "../lib/api";


export const getStationDashboardRealtime = async (params) => {
  const response = await api.post('/stations/dashboard/realtime', params);
  return response.data.data;
};

export const getStationDashboardLine = async ({ PJID, STID, ...params }) => {
  const response = await api.get(`/analytics/${PJID}/${STID}/line`, {
    params: params
  });

  return response.data.data;
};

export const getStationDashboardBoxplot = async ({ PJID, STID, ...params }) => {
  const response = await api.get(`/analytics/${PJID}/${STID}/boxplot`, { 
    params: params 
  });

  return response.data.data;
};

export const getStationDashboardHeatmap = async ({ PJID, STID, ...params }) => {
  const response = await api.get(`/analytics/${PJID}/${STID}/heatmap`, { 
    params: params 
  });

  return response.data.data;
};

export const getStationDashboardWindRose = async ({ PJID, STID, ...params }) => {
  const response = await api.get(`/analytics/${PJID}/${STID}/wind-rose`, { 
    params: params 
  });

  return response.data.data;
};

export const getStationDashboardWindVector = async ({ PJID, STID, ...params }) => {
  const response = await api.get(`/analytics/${PJID}/${STID}/wind-vector`, { 
    params: params 
  });

  return response.data.data;
};

export const getStationDashboardTable = async (params) => {
  const response = await api.post('/stations/dashboard/table', params);
  return response.data.data;
};

export const getStationDashboardDailyReport = async (params) => {
  const response = await api.post('/stations/dashboard/daily-report', params);
  return response.data.data;
};

export const getStationDashboardMonthlyReport = async (params) => {
  const response = await api.post('/stations/dashboard/monthly-report', params);
  return response.data.data;
};

export const getEpaDashboardRealtime = async (params) => {
  const response = await api.post('/open-data/dashboard/realtime', params);
  return response.data.data;
};

export const getEpaDashboardLine = async (params) => {
  const response = await api.post('/open-data/dashboard/line', params);
  return response.data.data;
};

export const getEpaDashboardBoxplot = async (params) => {
  const response = await api.post('/open-data/dashboard/boxplot', params);
  return response.data.data;
};

export const getEpaDashboardHeatmap = async (params) => {
  const response = await api.post('/open-data/dashboard/heatmap', params);
  return response.data.data;
};

export const getEpaDashboardWindRose = async (params) => {
  const response = await api.post('/open-data/dashboard/wind-rose', params);
  return response.data.data;
};

export const getEpaDashboardWindVector = async (params) => {
  const response = await api.post('/open-data/dashboard/wind-vector', params);
  return response.data.data;
};

export const getEpaDashboardTable = async (params) => {
  const response = await api.post('/open-data/dashboard/table', params);
  return response.data.data;
};

export const getEpaDashboardDailyReport = async (params) => {
  const response = await api.post('/open-data/dashboard/daily-report', params);
  return response.data.data;
};

export const getEpaDashboardMonthlyReport = async (params) => {
  const response = await api.post('/open-data/dashboard/monthly-report', params);
  return response.data.data;
};
