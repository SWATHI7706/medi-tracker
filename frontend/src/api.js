import axios from "axios";

// Environment-driven API endpoints with smart fallback for Cloud Run & local dev
export const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" && window.location.port === "5173"
        ? "http://localhost:8000/api"
        : "/api");

export const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    (API_BASE_URL.endsWith("/api") ? API_BASE_URL.slice(0, -4) : (API_BASE_URL === "/api" ? "" : API_BASE_URL));

// Configure default axios request interceptor for JWT authorization
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("authToken");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default axios;
