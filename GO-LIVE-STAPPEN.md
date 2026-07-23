# ANIMOOH! webshop — go-live checklist

De code voor de eigen webshop (Mollie-betalingen + klaar voor Adsolut) staat er.
Dit is wat er nog moet gebeuren voor er echt verkocht kan worden — in volgorde.

## 1. Prijzen invullen (nodig voor alles)
- Open `lib/catalog.js`
- Vul voor elk product `priceEUR` in als tekst, bv. `"14.95"` (nu staat overal `null` — producten zonder prijs kunnen bewust niet gekocht worden)
- Vul `SHIPPING_EUR` in (vaste verzendkost per bestelling; `"0.00"` = gratis verzending)

## 2. Mollie-account
- Maak een account op https://www.mollie.com (bedrijfsgegevens + bankrekening nodig)
- In het Mollie-dashboard vind je twee API-sleutels:
  - `test_...` → om te testen (geen echt geld)
  - `live_...` → voor echte betalingen (pas na goedkeuring door Mollie)

## 3. Hosting verhuizen van GitHub Pages naar Vercel
GitHub Pages kan geen betalingen verwerken (alleen statische bestanden). Vercel wél, en het is gratis:
- Maak een account op https://vercel.com en log in met je GitHub-account
- "Add New Project" → kies je repository `ANIMOOH-frontend-website` → Deploy
- Bij Settings → Environment Variables, voeg toe:
  - `MOLLIE_API_KEY` = je `test_...` sleutel (later vervangen door `live_...`)
  - `SITE_URL` = het adres dat Vercel je geeft, bv. `https://animooh.vercel.app` (zonder / op het einde)
- Vanaf nu: elke push naar GitHub = site automatisch bijgewerkt (nooit meer handmatig uploaden)

## 4. Testen (met test-sleutel, geen echt geld)
- Klik op de site op "Koop nu", vul het formulier in, kies op de Mollie-testpagina "Paid"
- Check of je op de bedankt-pagina komt met "Betaling gelukt"
- Bestellingen (incl. adres van de klant) zie je in het Mollie-dashboard onder Payments → metadata

## 5. Live gaan
- Vervang op Vercel `MOLLIE_API_KEY` door je `live_...` sleutel zodra Mollie je account heeft goedgekeurd
- Doe één echte testbestelling van bv. €0,01? Nee — Mollie heeft een minimum; doe één echte kleine bestelling en betaal ze zelf terug via het dashboard (Refund)

## 6. Adsolut koppelen (fase 2)
- Activeer API-toegang voor jullie installatie via My Adsolut (my.adsolut.com)
- Technische documentatie: https://api-portal.adsolut.com/
- Met die toegangsgegevens bouwen we `lib/adsolut.js` af:
  - voorraad live tonen op de site (uitverkocht = niet bestelbaar)
  - betaalde bestellingen automatisch als order in Adsolut (facturatie + voorraadafboeking)

## Belangrijk tot de verhuis naar Vercel klaar is
Push deze wijzigingen nog NIET naar GitHub zolang de site nog op GitHub Pages draait:
de "Koop nu"-knoppen werken daar niet (geen backend) en de bol.com-knoppen zijn al vervangen.
Eerst stap 1 t.e.m. 3 afronden, dan pushen — dan is alles in één keer live.
