import { useCallback, useEffect, useRef, useState } from "react"

type SocketStatus = "disconnected" | "connecting" | "connected" | "mock"

export function useWebSocket(url?: string) {
  const socketRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<SocketStatus>("disconnected")
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      setStatus("mock")
      return
    }

    setStatus("connecting")
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => setStatus("connected")
    socket.onmessage = (event) => setLastMessage(event.data as string)
    socket.onclose = () => setStatus("disconnected")
    socket.onerror = () => setStatus("mock")

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [url])

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message)
    }
  }, [])

  return { status, lastMessage, sendMessage }
}
