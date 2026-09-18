import api from "../lib/api";


export const getProjectsList = async () => {
  const response = await api.post(`/projects`);
  return response.data.data;
};

export const getStationList = async (params) => {
  const response = await api.post(`/projects/stations`, params);
  return response.data.data;
};

export const getStationDetailInfoData = async (params) => {
  const response = await api.post(`/stations/detail`, params);
  return response.data.data;
};

export const getMissingHourData = async (params) => {
  const response = await api.post(`/projects/missing-hour`, params);
  return response.data.data;
};

export const getThresholdOverData = async (params) => {
  const response = await api.post(`/projects/thresholdOver`, params);
  return response.data.data;
};

export const getDisconnectedData = async (params) => {
  const response = await api.post(`/projects/disconnections`, params);
  return response.data.data;
};

export const getDecommissionedData = async (params) => {
  const response = await api.post(`/stations/uninstalled`, params);
  return response.data.data;
};

export const addDecommissionedStation = async (params) => {
  const response = await api.post(`/add/stations/uninstalled`, params);
  return response.data.data;
};

export const editDecommissionedStation = async (params) => {
  const response = await api.put(`/edit/stations/uninstalled`, params);
  return response.data.data;
};

export const deleteDecommissionedStation = async (params) => {
  const response = await api.delete(`/delete/stations/uninstalled`, { data: params });
  return response.data.data;
};

export const getInspectionData = async (params) => {
  const response = await api.post(`/stations/inspections`, params, { timeout: 60000 });
  return response.data.data;
};

export const getInspectionImage = async (url, signal) => {
  const response = await api.get(url, { responseType: "blob", signal, timeout: 60000 });
  return response.data;
};

export const addInspectionData = async (params) => {
  const response = await api.post(`/add/stations/inspections`, params);
  return response.data;
};

export const getStationHealthData = async (params) => {
  const response = await api.post(`/stations/health-reports`, params);
  return response.data.data;
};

export const getDisconnectionDetailsData = async (params) => {
  const response = await api.post(`/stations/disconnections/detail`, params);
  return response.data.data;
};

export const getNearbyStationsData = async (params) => {
  const response = await api.post(`/stations/nearby`, params);
  return response.data.data;
};

export const getAuthorizedStationsData = async (params) => {
  const response = await api.post(`/user/stations`, params);
  return response.data.data;
};

export const getProjectHealthData = async (params) => {
  const response = await api.post(`/stations/health-reports/detail`, params);
  return response.data.data;
};

export const getStationDisconnectedData = async (params) => {
  const response = await api.post(`/stations/disconnections/status`, params);
  return response.data.data;
};

export const getStationData = async (STID, params) => {
  const response = await api.post(`/station/data/${STID}`, params);
  return response.data.data;
};

export const getStationModelData = async (STID, params) => {
  const response = await api.post(`/station/model/${STID}`, params);
  return response.data.data;
};

