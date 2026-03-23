"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getToken } from "@/lib/auth";
import { WSMessage } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL;
if (!WS_URL) {
  throw new Error("Missing required env var NEXT_PUBLIC_WS_URL");
}
const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 30000;

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws/team?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingTimer.current) clearInterval(pingTimer.current);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [connect]);

  return { connected };
}
