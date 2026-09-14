import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_BASE_URL,
  timeout: 10000,
});


// 自動帶 token
api.interceptors.request.use((config) => {
  const token = Cookies.get("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response, 
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      Cookies.remove("ID");
      Cookies.remove("name");

      window.location.href = "/aiot/login";
    }

    return Promise.reject(error);
  }
);

export default api;