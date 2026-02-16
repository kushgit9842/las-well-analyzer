import axios from "axios";

const api = axios.create({
  baseURL: "https://las-backend.onrender.com/api",
});

export default api;