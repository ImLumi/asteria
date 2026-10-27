1. A dia film edit modalban legyen egy képminőség javitás checkbox.
2. ha bevan kapcsolva a képminőség javitás akkor:

- töltse le az adott diafilmhöz tartozó összes képet.
- a letöltött képeken végezzen el a sharp js libbel képjavitásokat:
  - bontsa szét rgb szinekre és szin sávonkét normalize-olja majd egyesitse ujra.
  - lanczos3 módszerrel upscaleelj.
  - végül diafilmre optimalizált sharpen methoddal élesits.

3. Csak a feljavitott képeket tárolja végül.
4. ha az adott diafilm beállitásánál be van kapcsolva a javitott képminöség akkor ne a külső image-et jelenitse meg, hanem a lementett javitott diákat.
