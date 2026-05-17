import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const adminApi = axios.create({ baseURL, withCredentials: true })

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/admin/auth/me')) {
      window.location.href = '/admin'
    }
    return Promise.reject(error)
  },
)

export default adminApi
