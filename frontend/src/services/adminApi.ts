import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const adminApi = axios.create({ baseURL })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('noshow_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('noshow_admin_token')
      window.location.href = '/admin'
    }
    return Promise.reject(error)
  },
)

export default adminApi
