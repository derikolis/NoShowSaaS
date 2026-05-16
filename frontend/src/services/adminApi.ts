import axios from 'axios'

const adminApi = axios.create({ baseURL: '/api' })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('noshow_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default adminApi
