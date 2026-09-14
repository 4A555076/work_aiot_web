import api from "../lib/api";

export const getSensorReplacementReport = async (params) => {
  const response = await api.post(`/sensor/replacementReport`, params);
  return response.data.data;
};

export const getTestIdDateRangeList = async (params) => {
  const response = await api.post(`/sensors/test-serials`, params);
  return response.data.data;
};

export const getSensorComponentSerialsList = async (params) => {
  const response = await api.post(`/sensors/component-serials`, params);
  return response.data.data;
};

export const getSensorHealthData = async (params) => {
  const response = await api.post(`/sensors/health-reports`, params);
  return response.data.data;
};

export const getSensorHealthImage = async (params) => {
  const response = await api.post(`/sensors/health-image`, params, { responseType: 'blob' });
  return response.data;
};

export const getPCBList = async () => {
  const response = await api.post(`/pcbs`);
  return response.data.data;
};

export const getQaqcTestSerialsData = async (params) => {
  const response = await api.post(`/sensors/qaqc/test-serials`, params);
  return response.data;
};

export const getQaqcData = async (params) => {
  const response = await api.post(`/sensors/qaqc/SN`, params);
  return response.data;
};

export const addQaqcData = async (params) => {
  const response = await api.post(`/add/sensors/qaqc/SN`, params);
  return response.data;
};

export const updateQaqcData = async (params) => {
  const response = await api.put(`/update/sensors/qaqc/SN`, params);
  return response.data;
};

export const calculateQaqcData = async (params) => {
  const response = await api.put(`/update/sensors/qaqc/qaCease`, params);
  return response.data;
};

export const deleteQaqcData = async (params) => {
  const response = await api.delete(`/delete/sensors/qaqc/SN`, { data: params });
  return response.data;
};

export const updateSensorStation = async (params) => {
  const response = await api.post(`/update/sensor/station`, params);
  return response.data;
};
