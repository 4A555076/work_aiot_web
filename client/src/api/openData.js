import api from "../lib/api";


export const getTaqmnStationList = async () => {
  const response = await api.get(`/taqmn/stations`);
  return response.data.data;
};


export const getTAQMNStationData = async ({ STID, ...params }) => {
  const response = await api.get(`/taqmn/${STID}/data`, {
    params,
  });

  return response.data.data;
};
