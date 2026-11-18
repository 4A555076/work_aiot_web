import api from "../lib/api";

export const getFireProjects = async () => {
  const response = await api.get(`/fire/projects`);
  return response.data.data;
};

export const getFireReport = async ({ ENID, ...params }) => {
  const response = await api.get(`/fire/${ENID}/reports`, {
    params, 
  });
  
  return response.data.data;
};