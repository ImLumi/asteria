import type { WebSocket, WebSocketServer } from "ws"

/**
 * ESP32 -> szerver események (plan.md szerinti struktúra)
 */
export type Esp32WsMessage =
  | { event: "connected"; device: string }
  | { event: "rotate"; dir: "CW" | "CCW"; steps: number }
  | { event: "click" }
  | { event: "nfc"; uid: string }

/**
 * Böngésző -> szerver vezérlő üzenetek
 */
export type BrowserControlMessage =
  { type: "hello" } | { type: "pair"; device: string } | { type: "unpair" }

interface ClientMeta {
  role: "esp32" | "browser"
  ip: string
  device: string | null
  pairedDevice: string | null
}

// Kliens-meta: ws -> meta
const clients = new Map<WebSocket, ClientMeta>()
// WS room-ok: esp32 egyedi azonosító (device) -> párosított böngészők
const rooms = new Map<string, Set<WebSocket>>()

// IPv4-mapped / localhost címek normalizálása, hogy az IP-alapú felismerés működjön
function normalizeIp(ip: string | undefined): string {
  if (!ip) return ""
  if (ip.startsWith("::ffff:")) return ip.slice(7)
  if (ip === "::1") return "127.0.0.1"
  return ip
}

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return false
  return (
    p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254)
  )
}

// Azonos hálózatnak számít: azonos IP (NAT mögött), azonos helyi /24 alhálózat,
// vagy a szerver gépéről (localhost) nyitott böngésző és egy helyi hálózati eszköz
function sameNetwork(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const aLoop = a === "127.0.0.1"
  const bLoop = b === "127.0.0.1"
  if (aLoop || bLoop) return isPrivateIpv4(aLoop ? b : a)
  if (!isPrivateIpv4(a) || !isPrivateIpv4(b)) return false
  return a.split(".").slice(0, 3).join(".") === b.split(".").slice(0, 3).join(".")
}

// A ws kliens mögötti socket távoli címe (a NextRequest nem hozza az IP-t)
function getRemoteAddress(client: WebSocket): string | undefined {
  return (client as unknown as { _socket?: { remoteAddress?: string } })._socket
    ?.remoteAddress
}

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

function getRoom(device: string): Set<WebSocket> {
  let room = rooms.get(device)
  if (!room) {
    room = new Set()
    rooms.set(device, room)
  }
  return room
}

function removeFromRoom(ws: WebSocket, meta: ClientMeta | undefined): void {
  if (!meta || !meta.pairedDevice) return
  const room = getRoom(meta.pairedDevice)
  room.delete(ws)
  if (room.size === 0) rooms.delete(meta.pairedDevice)
  meta.pairedDevice = null
}

// Ugyanazon IP-n lévő online ESP32-k felajánlása a böngészőnek
function sendSuggestions(ws: WebSocket): void {
  const meta = clients.get(ws)
  if (!meta) return
  const devices: { device: string; ip: string }[] = []
  for (const m of clients.values()) {
    if (m.role === "esp32" && m.device && sameNetwork(m.ip, meta.ip)) {
      devices.push({ device: m.device, ip: m.ip })
    }
  }
  send(ws, { type: "suggest", devices })
}

// ESP32 üzenet továbbítása: csak az eszközhöz párosított (ws room) böngészőknek
function forwardToBrowsers(
  fromWs: WebSocket,
  meta: ClientMeta,
  msgString: string
): void {
  const room = meta.device ? rooms.get(meta.device) : undefined
  if (!room) return

  for (const ws of room) {
    if (ws !== fromWs && ws.readyState === ws.OPEN) ws.send(msgString)
  }
}

export function UPGRADE(client: WebSocket, _server: WebSocketServer) {
  const clientIp = normalizeIp(getRemoteAddress(client))
  clients.set(client, {
    role: "browser",
    ip: clientIp,
    device: null,
    pairedDevice: null,
  })
  console.log(`🟢 Új kliens csatlakozott: ${clientIp}`)

  client.on("message", (data) => {
    const msgString = data.toString()
    console.log(`📩 Bejövő adat (${clientIp}): ${msgString}`)

    let msg: { event?: unknown; type?: unknown; device?: unknown }
    try {
      msg = JSON.parse(msgString)
    } catch {
      return // nem JSON üzenetet nem dolgozunk fel
    }

    const meta = clients.get(client)
    if (!meta || !msg || typeof msg !== "object") return

    // ESP32 bejelentkezés: { event: "connected", device: "<egyedi azonosító>" }
    if (msg.event === "connected" && typeof msg.device === "string") {
      meta.role = "esp32"
      meta.device = msg.device
      console.log(`🎛️  ESP32 regisztrálva: ${msg.device} (${clientIp})`)

      // Böngészők értesítése, az azonos IP-n lévőknek újra felajánljuk
      for (const [other, m] of clients) {
        if (m.role !== "esp32") {
          send(other, {
            type: "device_online",
            device: msg.device,
            ip: clientIp,
          })
          sendSuggestions(other)
        }
      }
      // A "connected" üzenetet is továbbítjuk a vetítő felületnek
      forwardToBrowsers(client, meta, msgString)
      return
    }

    // Böngésző bejelentkezés -> azonnal felajánljuk az azonos IP-n lévő eszközöket
    if (msg.type === "hello") {
      meta.role = "browser"
      sendSuggestions(client)
      return
    }

    // Párosítás (ws room) az ESP32 egyedi azonosítója alapján
    if (msg.type === "pair" && typeof msg.device === "string") {
      removeFromRoom(client, meta)
      meta.pairedDevice = msg.device
      getRoom(msg.device).add(client)

      const online = [...clients.values()].some(
        (m) => m.role === "esp32" && m.device === msg.device
      )
      console.log(
        `🔗 Böngésző párosítva: ${clientIp} -> ${msg.device} (online: ${online})`
      )
      send(client, { type: "paired", device: msg.device, online })
      return
    }

    // Párosítás bontása
    if (msg.type === "unpair") {
      const old = meta.pairedDevice
      removeFromRoom(client, meta)
      console.log(`⛓️‍💥 Párosítás bontva: ${clientIp} -/-> ${old}`)
      send(client, { type: "unpaired" })
      return
    }

    // ESP32 események (rotate / click / nfc) továbbítása a böngészőknek
    if (meta.role === "esp32") {
      forwardToBrowsers(client, meta, msgString)
    }
  })

  client.once("close", () => {
    const meta = clients.get(client)
    removeFromRoom(client, meta)
    clients.delete(client)

    if (meta && meta.role === "esp32" && meta.device) {
      console.log(`🔴 ESP32 lecsatlakozott: ${meta.device} (${clientIp})`)
      for (const [other, m] of clients) {
        if (m.role !== "esp32") {
          send(other, { type: "device_offline", device: meta.device })
        }
      }
    } else {
      console.log(`🔴 Kliens lecsatlakozott: ${clientIp}`)
    }
  })
}

// Normál HTTP GET-re egy kis státusz (debug / "van-e csatlakoztatott eszköz")
export function GET() {
  const devices = [...clients.values()]
    .filter((m) => m.role === "esp32")
    .map((m) => ({ device: m.device, ip: m.ip }))
  return Response.json({ clients: clients.size, devices })
}
