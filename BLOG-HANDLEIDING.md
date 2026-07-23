# Blog gebruiken — een nieuw artikel toevoegen

De blog werkt via gewone tekstbestanden. Geen HTML, geen editor nodig — gewoon
een nieuw bestand met je tekst erin, en de site doet de rest (styling, datum,
lijstweergave op /blog).

## Zo voeg je een nieuw artikel toe

1. Maak een nieuw bestand in de map `blog-posts`, bijvoorbeeld:
   `blog-posts/waarom-organisch-belangrijk-is.md`
   (de bestandsnaam wordt automatisch de URL, dus gebruik geen spaties —
   koppeltekens `-` in plaats van spaties)

2. Begin het bestand met deze 3 regels (pas de tekst aan):
   ```
   title: Waarom organisch echt een verschil maakt
   date: 2026-07-25
   description: Korte samenvatting van 1-2 zinnen voor Google en social media.
   ---
   ```
   Let op: de datum moet in dit formaat staan: `JJJJ-MM-DD` (bv. `2026-07-25`),
   anders komt de sortering op de bloglijst door elkaar.

3. Schrijf daaronder gewoon je artikel, in normale tekst. Enkele handige trucjes:
   - `## Een kopje` → wordt een grote titel binnen het artikel
   - `**vet**` → **vet**
   - `*cursief*` → *cursief*
   - `[linktekst](/products.html)` → een klikbare link

4. Sla het bestand op, en vraag mij om het te pushen (of doe het zelf via
   `git add -A`, `git commit -m "Nieuw blogartikel"`, `git push`).

Dat is alles — geen andere bestanden hoeven aangepast te worden. Zodra het
online staat, verschijnt het artikel automatisch bovenaan op `/blog`.

## Belangrijk: dit werkt pas zodra we op Vercel draaien

De blog wordt "live" gebouwd door de server (net zoals de Mollie-checkout) —
dit werkt niet op de huidige GitHub Pages hosting. Zie `GO-LIVE-STAPPEN.md`
voor de stappen om naar Vercel te verhuizen.
