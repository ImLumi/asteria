# Next.js template

This is a Next.js template with shadcn/ui.

## Vezérlés

A vezérlő forgatásával a kezdőlapon a diafilmek között lehet lépkedni;
a kijelölt diafilmet fehér keret jelzi. A vezérlő megnyomása megnyitja a
kijelölt diafilmet. Ha még nincs kijelölés, az első diafilm nyílik meg.
Nyitott párbeszédablak mellett a vezérlő nem vált diafilmet.
A TV távirányítójának nyilaival is lehet lépkedni a csempék között;
az OK/Enter megnyitja a kiválasztott diafilmet.

## Képminőség javítása

A diafilm szerkesztésénél jelöld be a **Képminőség javítás** opciót és
mentsd el. A szerver letölti és automatikusan feljavítja a képkockákat;
a mentés a teljes feldolgozás idejéig tarthat. Ezután a borító és a vetítés
a szerveren tárolt képeket használja. A kezdő link módosítása bekapcsolt
javítás mellett újragenerálja a képeket.

A jelölőnégyzet kikapcsolása visszaállítja az eredeti képek használatát.
Újbóli bekapcsoláskor a képek újragenerálódnak, így a képjavító nézetben
korábban megadott kézi javítások felülíródnak. Sikertelen feldolgozáskor
a mentés hibát jelez, és a korábbi beállítás és képkészlet megmarad.

A képjavítás integrációs tesztje: `npm run test:enhance`.

## HTTP image sources

HTTP filmstrip images are fetched and cached by the Next.js image optimizer and
served from the application origin, including the cover and all slideshow
frames. HTTPS images continue to load directly. The optimizer accepts public
HTTP image URLs from any host, so its endpoint can also be used for other public
HTTP images; Next.js blocks local and private IP addresses by default. Image
optimization requires a writable Next.js image cache.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
