import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'

export function useSignalR(onReady: (conn: signalR.HubConnection) => void) {
  const connRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/orders', {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build()

    conn.start().then(() => onReady(conn)).catch(() => {})
    connRef.current = conn

    return () => { conn.stop() }
  }, [])

  return connRef
}
