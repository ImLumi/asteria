# Next.js template

This is a Next.js template with shadcn/ui.

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
