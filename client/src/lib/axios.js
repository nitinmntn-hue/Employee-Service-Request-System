import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1",

  headers: {
    "Content-Type": "application/json",
  },

  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Handle API errors
api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const currentPath = window.location.pathname;

      if (status === 401 && currentPath !== "/login") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");

        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
