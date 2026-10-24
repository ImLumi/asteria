"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"

import { findFilmByNfcUid } from "@/app/actions"

export type WsStatus = "connecting" | "open" | "closed"
export type SuggestedDevice = { device: string; ip: string }
export type RotateEvent = { event: "rotate"; dir: "CW" | "CCW"; steps: number }
export type ControllerEvent = RotateEvent | { event: "click" }

type ControllerContextValue = {
  wsUrl: string
  defaultWsUrl: string
  isCustomUrl: boolean
  setCustomWsUrl: (url: string | null) => void
  status: WsStatus
  suggestions: SuggestedDevice[]
  pairedDevice: string | null
  deviceOnline: boolean
  pair: (device: string) => void
  unpair: () => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  lastNfc: { uid: string; at: number } | null
  subscribe: (listener: (event: ControllerEvent) => void) => () => void
}

const WS_URL_KEY = "asteria.wsUrl"
const DEVICE_KEY = "asteria.device"

const ControllerContext = createContext<ControllerContextValue | null>(null)

function getDefaultWsUrl(): string {
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  return `${proto}://${window.location.host}/api/ws`
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // a tárolás nem elérhető (pl. privát mód) – nem kritikus
  }
}

export function ControllerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const [defaultWsUrl] = useState(getDefaultWsUrl)
  const [customUrl, setCustomUrl] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStorage(WS_URL_KEY)
  )
  const [status, setStatus] = useState<WsStatus>("closed")
  const [suggestions, setSuggestions] = useState<SuggestedDevice[]>([])
  const [pairedDevice, setPairedDevice] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStorage(DEVICE_KEY)
  )
  const [deviceOnline, setDeviceOnline] = useState(false)
  const [settingsOpen, setSettingsOpenState] = useState(false)
  const [lastNfc, setLastNfc] = useState<{ uid: string; at: number } | null>(
    null
  )

  const wsRef = useRef<WebSocket | null>(null)
  const pairedRef = useRef(pairedDevice)
  const settingsOpenRef = useRef(false)
  const listenersRef = useRef(new Set<(event: ControllerEvent) => void>())

  const wsUrl = customUrl || defaultWsUrl

  useEffect(() => {
    pairedRef.current = pairedDevice
  }, [pairedDevice])

  const handleNfc = useCallback(
    async (uid: string) => {
      if (settingsOpenRef.current) {
        setLastNfc({ uid, at: Date.now() })
        return
      }
      const film = await findFilmByNfcUid(uid)
      if (film && !settingsOpenRef.current) router.push(`/film/${film.id}`)
    },
    [router]
  )

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw)
      } catch {
        return
      }
      if (!msg || typeof msg !== "object") return

      switch (msg.type) {
        case "suggest":
          setSuggestions(
            Array.isArray(msg.devices) ? (msg.devices as SuggestedDevice[]) : []
          )
          return
        case "paired":
          if (typeof msg.device === "string") {
            setPairedDevice(msg.device)
            setDeviceOnline(msg.online === true)
            writeStorage(DEVICE_KEY, msg.device)
          }
          return
        case "unpaired":
          setPairedDevice(null)
          setDeviceOnline(false)
          writeStorage(DEVICE_KEY, null)
          return
        case "device_online":
          if (msg.device === pairedRef.current) setDeviceOnline(true)
          return
        case "device_offline":
          if (msg.device === pairedRef.current) setDeviceOnline(false)
          return
      }

      if (msg.event === "nfc" && typeof msg.uid === "string") {
        void handleNfc(msg.uid)
      } else if (msg.event === "rotate" || msg.event === "click") {
        for (const listener of listenersRef.current) {
          listener(msg as unknown as ControllerEvent)
        }
      }
    },
    [handleNfc]
  )

  useEffect(() => {
    if (!wsUrl) return
    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const connect = () => {
      setStatus("connecting")
      try {
        ws = new WebSocket(wsUrl)
      } catch {
        setStatus("closed")
        return
      }
      wsRef.current = ws
      const socket = ws

      socket.onopen = () => {
        setStatus("open")
        socket.send(JSON.stringify({ type: "hello" }))
        if (pairedRef.current) {
          socket.send(JSON.stringify({ type: "pair", device: pairedRef.current }))
        }
      }
      socket.onmessage = (e) => {
        if (typeof e.data === "string") handleMessage(e.data)
      }
      socket.onclose = () => {
        if (wsRef.current === socket) wsRef.current = null
        setStatus("closed")
        setSuggestions([])
        setDeviceOnline(false)
        if (!stopped) timer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [wsUrl, handleMessage])

  const sendJson = useCallback((payload: unknown) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }, [])

  const pair = useCallback(
    (device: string) => sendJson({ type: "pair", device }),
    [sendJson]
  )
  const unpair = useCallback(() => sendJson({ type: "unpair" }), [sendJson])

  const setCustomWsUrl = useCallback((url: string | null) => {
    const value = url?.trim() || null
    writeStorage(WS_URL_KEY, value)
    setCustomUrl(value)
  }, [])

  const setSettingsOpen = useCallback((open: boolean) => {
    settingsOpenRef.current = open
    if (open) setLastNfc(null)
    setSettingsOpenState(open)
  }, [])

  const subscribe = useCallback(
    (listener: (event: ControllerEvent) => void) => {
      listenersRef.current.add(listener)
      return () => {
        listenersRef.current.delete(listener)
      }
    },
    []
  )

  const value = useMemo<ControllerContextValue>(
    () => ({
      wsUrl,
      defaultWsUrl,
      isCustomUrl: customUrl !== null,
      setCustomWsUrl,
      status,
      suggestions,
      pairedDevice,
      deviceOnline,
      pair,
      unpair,
      settingsOpen,
      setSettingsOpen,
      lastNfc,
      subscribe,
    }),
    [
      wsUrl,
      defaultWsUrl,
      customUrl,
      setCustomWsUrl,
      status,
      suggestions,
      pairedDevice,
      deviceOnline,
      pair,
      unpair,
      settingsOpen,
      setSettingsOpen,
      lastNfc,
      subscribe,
    ]
  )

  return (
    <ControllerContext.Provider value={value}>
      {children}
    </ControllerContext.Provider>
  )
}

export function useController(): ControllerContextValue {
  const ctx = useContext(ControllerContext)
  if (!ctx) throw new Error("useController must be used within ControllerProvider")
  return ctx
}
