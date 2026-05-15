export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

export function ok<T>(data: T, message = 'OK'): ApiResponse<T> {
  return { success: true, message, data }
}

export function fail(message: string): ApiResponse<null> {
  return { success: false, message, data: null }
}
