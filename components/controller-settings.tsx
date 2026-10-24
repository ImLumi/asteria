"use client"

import { useEffect, useState } from "react"

import {
  assignNfcCard,
  findFilmByNfcUid,
  type FilmRef,
} from "@/app/actions"
import { useController, type WsStatus } from "@/components/controller-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_LABEL: Record<WsStatus, string> = {
  open: "Csatlakozva",
  connecting: "Csatlakozás...",
  closed: "Nincs kapcsolat",
}

function ServerSection() {
  const { wsUrl, defaultWsUrl, isCustomUrl, setCustomWsUrl, status } =
    useController()
  const [value, setValue] = useState(isCustomUrl ? wsUrl : "")

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="ws-url">WebSocket szerver</Label>
        <Badge variant={status === "open" ? "default" : "secondary"}>
          {STATUS_LABEL[status]}
        </Badge>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setCustomWsUrl(value)
        }}
      >
        <Input
          id="ws-url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={defaultWsUrl}
        />
        <Button type="submit" variant="secondary">
          Csatlakozás
        </Button>
      </form>
      {isCustomUrl && (
        <button
          type="button"
          className="w-fit text-xs text-muted-foreground underline"
          onClick={() => {
            setValue("")
            setCustomWsUrl(null)
          }}
        >
          Vissza az alapértelmezett szerverre
        </button>
      )}
    </section>
  )
}

function DeviceSection() {
  const { status, suggestions, pairedDevice, deviceOnline, pair, unpair } =
    useController()
  const [picking, setPicking] = useState(false)
  const [manualId, setManualId] = useState("")

  const connected = pairedDevice !== null && deviceOnline

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>Eszköz</Label>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected
            ? "Aktív eszköz"
            : pairedDevice
              ? "Eszköz offline"
              : "Nincs csatlakoztatott eszköz"}
        </Badge>
      </div>

      {pairedDevice && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-muted-foreground">{pairedDevice}</span>
          <Button variant="outline" size="sm" onClick={unpair}>
            Leválasztás
          </Button>
        </div>
      )}

      {!picking ? (
        <Button
          variant="secondary"
          disabled={status !== "open"}
          onClick={() => setPicking(true)}
        >
          Eszköz csatlakoztatása
        </Button>
      ) : (
        <div className="grid gap-3 rounded-2xl border p-3">
          {suggestions.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                Az azonos hálózaton talált eszközök:
              </p>
              {suggestions.map((s) => (
                <Button
                  key={s.device}
                  variant="outline"
                  className="justify-between"
                  onClick={() => {
                    pair(s.device)
                    setPicking(false)
                  }}
                >
                  <span className="truncate">{s.device}</span>
                  <span className="text-xs text-muted-foreground">{s.ip}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nem találtunk eszközt ezen a hálózaton. Add meg az ESP32 egyedi
              azonosítóját:
            </p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const id = manualId.trim()
              if (!id) return
              pair(id)
              setManualId("")
              setPicking(false)
            }}
          >
            <Input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Eszköz azonosító"
              aria-label="Eszköz azonosító"
            />
            <Button type="submit" variant="secondary" disabled={!manualId.trim()}>
              Összekötés
            </Button>
          </form>
          <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
            Mégse
          </Button>
        </div>
      )}
    </section>
  )
}

function NfcSection({ filmstrips }: { filmstrips: FilmRef[] }) {
  const { lastNfc } = useController()
  const [lookup, setLookup] = useState<{
    uid: string
    film: FilmRef | null
  } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uid = lastNfc?.uid ?? null
  const stamp = lastNfc?.at ?? null

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    findFilmByNfcUid(uid).then((film) => {
      if (cancelled) return
      setLookup({ uid, film })
      setSelected(null)
      setError(null)
    })
    return () => {
      cancelled = true
    }
  }, [uid, stamp])

  const loaded = uid !== null && lookup?.uid === uid
  const items = filmstrips.map((f) => ({ value: String(f.id), label: f.title }))

  async function save() {
    if (!uid || !selected) return
    setSaving(true)
    setError(null)
    const result = await assignNfcCard(uid, Number(selected))
    setSaving(false)
    if (result.ok && result.film) setLookup({ uid, film: result.film })
    else setError(result.error ?? "A mentés nem sikerült.")
  }

  return (
    <section className="grid gap-2">
      <Label>NFC kártya</Label>
      {!uid ? (
        <p className="rounded-2xl border border-dashed p-3 text-center text-sm text-muted-foreground">
          Olvasson be egy kártyát
        </p>
      ) : (
        <div className="grid gap-3 rounded-2xl border p-3">
          <p className="text-xs text-muted-foreground">
            UID: <span className="font-mono text-foreground">{uid}</span>
          </p>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Keresés...</p>
          ) : lookup?.film ? (
            <p className="text-sm">
              Hozzárendelt diafilm:{" "}
              <span className="font-medium">{lookup.film.title}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ehhez a kártyához még nincs diafilm rendelve.
            </p>
          )}

          {loaded && (
            <div className="flex gap-2">
              <Select
                items={items}
                value={selected}
                onValueChange={(v) => setSelected(v)}
                disabled={items.length === 0}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue
                    placeholder={
                      items.length === 0
                        ? "Nincs mentett diafilm"
                        : lookup?.film
                          ? "Másik diafilm választása"
                          : "Válassz diafilmet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={save} disabled={!selected || saving}>
                {saving ? "Mentés..." : "Mentés"}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export function ControllerSettingsDialog({
  filmstrips,
}: {
  filmstrips: FilmRef[]
}) {
  const { settingsOpen, setSettingsOpen } = useController()

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vezérlő beállítások</DialogTitle>
          <DialogDescription>
            ESP32 eszköz csatlakoztatása és NFC kártyák hozzárendelése.
          </DialogDescription>
        </DialogHeader>
        {settingsOpen && (
          <div className="grid gap-5">
            <ServerSection />
            <DeviceSection />
            <NfcSection filmstrips={filmstrips} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ControllerSettingsButton() {
  const { setSettingsOpen, status, pairedDevice, deviceOnline } =
    useController()
  const active = status === "open" && pairedDevice !== null && deviceOnline

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label="Vezérlő beállítások"
      className="relative"
      onClick={() => setSettingsOpen(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/control_knob.svg" alt="" className="size-6 dark:invert" />
      <span
        aria-hidden
        className={`absolute top-1.5 right-1.5 size-2 rounded-full ${active ? "bg-green-500" : "bg-muted-foreground/40"}`}
      />
    </Button>
  )
}
