# cél:

egy olyan honlap amin külsőlinken lévő diafilmeket (képek) lehet kivetiteni. A cél hogy projektorral lehető legjobban adja vissza egy diavetitő feelingjét.
A honlaphoz tartozik egy websocket alapú kapcsolat egy esp32 eszközzel amin van egy rotary encoder illetve egy NFC olvasó.
a görgetés hatására a diafilm előre/hátra tekeredik.
az nfc által küldött uid-t hozzá lehet rendelni egy adott diafilmhöz.
az esp a következő strukturába küldi az adatot ws-en:

```ts
type Esp32WsMessage =
 | { event: "connected"; device: string }
 | { event: "rotate"; dir: "CW" | "CCW"; steps: number }
 | { event: "click" }
 | { event: "nfc"; uid: string };
```

_ha rotate: "ccw" akkor a steps: negativ szám!_

## főoldal:

- középen legyenek csempék ami a diafilmek lesznek
- az első csempe mindig egy + jeles amivel új diafilmet lehet hozzáadni.
- a diafilmek mindig az első képet tartalmazzák, és a csempén belül található a diafilm neve.
- új dia hozzáadása:
  - egy modal ugrik fel rá.
  - a dia film cimét kötelező megadni.
  - a kezdő diafilm linkjét is kötelező megadni.
- jobb felső sarokban legyen a `public/icons/control_knob.svg` ikon
- a knob ikonra kattintva jöjjön fel egy controller settings modal
  - van egy eszköz csatlakoztatás gomb.
    - a ws szerver ajánlja fel az egy ip cimen lévő böngészőnek az azonos ip cimen lévő esp32-t.
    - ha nem ismeri fel akkor egy (esp32-n lévő egyedi azonositó) alapján lehessen össze kötni őket. (ws room).
  - visszajelez hogy van-e aktiv csatlakoztatott eszköz.
  - van egy custom ws szerverhez csatlakozás input, és itt mutassa meg hogy van-e aktiv ws szerver kapcsolat.
  - ha nyitva van ez a beállitás modal akkor az nfc által beolvasott uid nem inditja el automatikusan a diavetitést, hanem megjelenik itt egy selected listben az adott uid-hoz kapcsolódó diafilm.
  - ha nincs diafilm hozzárendelve az adott uid-hoz akkor jelezze hogy még nincs, és a select inputba a már tárolt diafilmek közül lehessen választani. Legyen egy mentés gomb is hozzá.
  - minden settings modal megnyitással resetelődjön a beolvasott NFC uid rész. és azt irja ki hogy 'Olvasson be egy kártyát'

## Diavetités

- ha egy diafilmre rákattintakak, vagy az nfc olvasó beolvas egy már mentett diafilmet akkor megnyilik teljes képernyőn a diavetités
- az adott az adott kezdő képkockához alakitsa a vetitést.
- függölegesen madjnem töltse ki teljesen a képernyőt, csak alul felül legyen egy keskeny fekete sáv.
- oldalt is teljesen fekete legyen.
- egy halvány X legyen a jobb felső sarokban.
- ha görgetünk az oldalon akkor a keret maradjon fix, és mögötte a képek mozogjanak.
- minden diakép egy külön image. ami a következő strukturája: 'https://...../.../* 01 *' a sorszám növekszik, egészen addig mig már nem ad vissza képet.
