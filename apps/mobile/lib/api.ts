import Constants from 'expo-constants'
import { supabase } from './supabase'

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options?.headers,
      },
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Request failed' }
    return { data: json.data }
  } catch {
    return { error: 'Network error' }
  }
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData
): Promise<{ data?: T; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: formData,
      headers: authHeaders,
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Upload failed' }
    return { data: json.data }
  } catch {
    return { error: 'Network error' }
  }
}
