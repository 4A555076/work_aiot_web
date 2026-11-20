import api from "../lib/api";

export const getPCBList = async () => {
  const response = await api.get(`/pcbs`);
  return response.data.data;
};

export const getTestIdDateRangeList = async (params) => {
  const response = await api.get(`/sensors/qaqc/test-serials`, {
    params: params
  });

  return response.data.data;
};

export const getSensorComponentSerialsList = async (params) => {
  const response = await api.get(`/sensors/qaqc/component-serials`, {
    params: params
  });

  return response.data.data;
};

export const getSensorHealthData = async (params) => {
  const response = await api.get(`/sensors/qaqc/health-reports`, {
    params: params
  });

  return response.data.data;
};

export const getSensorHealthImage = async ({ SN, PRSN }) => {
  const response = await api.get(`/sensors/qaqc/health-image/${encodeURIComponent(SN)}/${encodeURIComponent(PRSN)}`, {
    responseType: 'blob'
  });

  return response.data;
};

export const getQaqcData = async ({ SN }) => {
  const response = await api.get(`/sensors/qaqc/test/${encodeURIComponent(SN)}`);
  return response.data;
};

export const addQaqcData = async (params) => {
  const response = await api.post(`/sensors/qaqc/test`, 
    params
  );

  return response.data;
};

export const deleteQaqcData = async ({ SN }) => {
  const response = await api.delete(`/sensors/qaqc/test/${encodeURIComponent(SN)}`);
  return response.data;
};

export const updateQaqcData = async ( {SN, ...params }) => {
  const response = await api.put(`/sensors/qaqc/test/${SN}`, 
    params
  );

  return response.data;
};

export const calculateQaqcData = async ({ SN }) => {
  const response = await api.post(`/sensors/qaqc/test/${SN}/calculate`);
  return response.data;
};

export const getSensorReplacementReport = async (params) => {
  const response = await api.get(`/sensors/replace`, {
    params: params
  });
  
  return response.data.data;
};

export const updateSensorStation = async (params) => {
  const response = await api.post(`/sensors/replace`, params);
  return response.data;
};









