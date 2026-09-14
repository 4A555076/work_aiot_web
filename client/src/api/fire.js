import api from "../lib/api";

export const getFireProjects = async () => {
  const response = await api.post(`/fire/projects`);
  return response.data.data;
};

export const getFireReport = async (params) => {
  const response = await api.post(`/fire/reports`, params);
  return response.data.data;
};
