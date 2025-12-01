import { useCallback, useMemo } from "react"
import axios, { type AxiosRequestConfig } from "axios"

export function useApi() {
  const client = useMemo(() => {
    return axios.create({
      baseURL: import.meta.env.VITE_API_URL ?? "https://mock.camtc.health",
      timeout: 10_000,
    })
  }, [])

  const get = useCallback(
    async <T,>(url: string, config?: AxiosRequestConfig) => {
      const response = await client.get<T>(url, config)
      return response.data
    },
    [client],
  )

  const post = useCallback(
    async <T,>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
      const response = await client.post<T>(url, data, config)
      return response.data
    },
    [client],
  )

  return { get, post }
}
