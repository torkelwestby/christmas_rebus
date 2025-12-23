# Julerebus 2025 🎄

En interaktiv julerebus-app hvor brukere løser gåter for å låse opp opplevelser for 2026.

## Funksjoner

- 5 unike rebuser med bilder
- AI-drevet feedback ved feil svar (via OpenAI)
- Fyrverkeri-animasjon ved riktig svar
- Responsivt design med julete tema
- Progress tracking (X/5 løst)

## Teknologi

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- OpenAI API

## Kom i gang

1. Installer dependencies:
```bash
npm install
```

2. Kjør utviklingsserver:
```bash
npm run dev
```

3. Åpne [http://localhost:3000](http://localhost:3000)

## Rebus-løsninger

Appen sjekker at alle nøkkelord er med i svaret (symboler som komma ignoreres):

1. Pizza, øl og konkurranse på Oslo bowling
2. Helaften med vin og tartar på bislett
3. Fransk eventyrlig michelin opplevelse på mon oncl
4. Dagstur øst for Oslo med spa og velvære på the Well
5. En sliten søndag på den gule måke

## Airtable Database

Fremgang lagres i Airtable. Kolonnene opprettes automatisk med setup-scriptet:

```bash
npm run setup-airtable
```

Dette oppretter følgende kolonner i din Airtable-base:

**For hver rebus (1-5):**
- `rebusX_solved` - Checkbox (om rebusen er løst)
- `rebusX_date` - Date (planlagt dato)
- `rebusX_time` - Single line text (planlagt tidspunkt)

Appen bruker en enkelt rad i Airtable for å lagre all fremgang.

**Manuelt oppsett** (om du foretrekker det):
Se [scripts/setup-airtable.js](scripts/setup-airtable.js) for detaljer om felttyper og options.

## API

Appen bruker OpenAI API for å generere spesifikke og morsomme tilbakemeldinger når brukere svarer feil.
Feedbacken analyserer hva brukeren har riktig og gir hint om manglende ord.

API-nøklene er konfigurert i `.env.local`.

## Deploy til Vercel

```bash
vercel deploy
```

Husk å legge til `OPENAI_API_KEY` i Vercel environment variables.

## Struktur

```
src/
├── app/
│   ├── page.tsx                    # Hovedside med alle rebusene
│   ├── layout.tsx                  # Layout med julete styling
│   ├── globals.css                 # Styling + animasjoner
│   └── api/
│       └── check-rebus/
│           └── route.ts            # API for rebus-sjekking
public/
├── rebus1.png - rebus5.png         # Rebus-bilder
└── manifest.json
```
