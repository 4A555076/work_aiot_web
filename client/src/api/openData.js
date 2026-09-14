import api from "../lib/api";


export const getTaqmnStationList = async () => {
  const response = await api.post(`/TAQMN/stations`);
  return response.data.data;
};


export const getTAQMNStationData = async (STID, params) => {
  const response = await api.post(`/TAQMN/data/${STID}`, params);
  return response.data.data;
};
