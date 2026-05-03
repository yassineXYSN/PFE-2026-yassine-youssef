const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const getToken = () => localStorage.getItem('accessToken')
export const setToken = (t) => localStorage.setItem('accessToken', t)
export const clearAuth = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('userRole')
}

export function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = typeof err.detail === 'string'
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map((e) => e.msg).join(', ')
        : res.statusText
    throw new Error(msg)
  }
  return res.json()
}
