"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchAPI } from "@/lib/api"

export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    fetchAPI<T>(path)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [path])

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, refetch }
}
