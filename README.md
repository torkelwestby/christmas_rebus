# inspiration_bank

Kjør disse i terminal for å få noen pakker:
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt



# Idéinnsamlingsapp

Produksjonsklar app for å samle inn og administrere ideer med Airtable som backend.

## Features

✅ Rask innsending fra mobil og desktop  
✅ Bildeopplasting via Cloudinary  
✅ Oversikt med søk, filter og paginering  
✅ Rate limiting (5 kall/10 sek)  
✅ PWA-støtte for mobil  
✅ TypeScript + Zod validering  

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- React Hook Form + Zod
- Airtable API
- Cloudinary (unsigned upload)

## Setup

### 1. Installer dependencies

```bash
npm install
```

### 2. Konfigurer miljøvariabler

Opprett `.env.local`:

```env
AIRTABLE_TOKEN=pat_xxx
AIRTABLE_BASE_ID=appuubMFIhd5QTbzf
AIRTABLE_TABLE_ID=tblSPz6ovHbS8Lpa5
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_UPLOAD_PRESET=unsigned_xxx
```

### 3. Kjør lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

### 4. Deploy til Vercel

```bash
vercel
```

Eller koble repo til Vercel Dashboard og legg inn miljøvariabler under Project Settings.

## Airtable-oppsett

Tabellen "Ideer" må ha følgende felter:

- **Tittel** (text) - `fldKXo4ub5pqqTjG9`
- **Beskrivelse** (long text) - `fld0mPPNrE5pRxENI`
- **Type** (single select) - `fldhBleuXFNt9bWLP`
  - Verdier: "Inspirasjon", "Ide klar for vurdering til innovasjonsporteføljen"
- **Stage** (single select) - `fldTOdb9VgP0MdtNN`
  - Verdier: "Idégenerering", "Idéutforsking", "Problem/Løsning", "Produkt/Marked", "Skalering", "Arkivert"
- **Bilde** (attachment) - `fldz4NQq8uolOnbRY`
- **Innsender** (text) - `fldfG5fBJ8E9iNVa1`
- **Dato sendt inn** (date) - `fld9Hi3Emxlhoi9GE`

## Cloudinary-oppsett

1. Opprett unsigned upload preset i Cloudinary Dashboard
2. Settings → Upload → Add upload preset
3. Signing Mode: Unsigned
4. Kopier preset-navnet til `CLOUDINARY_UPLOAD_PRESET`

## Testing

```bash
npm test
```

## Struktur

```
src/
├── app/
│   ├── page.tsx              # Skjemaside
│   ├── ideas/
│   │   └── page.tsx          # Oversiktsside
│   ├── api/
│   │   └── ideas/
│   │       └── route.ts      # API endpoints
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── airtable.ts           # Airtable fetch wrapper
│   ├── ratelimit.ts          # Rate limiting
│   └── schemas.ts            # Zod schemas
└── components/
    ├── IdeaForm.tsx          # Hovedskjema
    └── IdeaList.tsx          # Oversiktsliste

public/
├── bama.png                  # Valgfri logo
└── manifest.json             # PWA manifest
```

## API

### POST /api/ideas

Send inn ny idé.

**Body:**
```json
{
  "title": "Min idé",
  "description": "Beskrivelse...",
  "type": "Inspirasjon",
  "stage": "Idégenerering",
  "submitter": "Navn Navnesen",
  "imageUrl": "https://res.cloudinary.com/..."
}
```

**Response:** `201` eller `4xx/5xx`

### GET /api/ideas

Hent ideer med paginering.

**Query params:**
- `max` (default: 50)
- `offset` (fra forrige respons)

**Response:**
```json
{
  "records": [...],
  "offset": "itrXXX/recYYY"
}
```

## Lisens

Privat prosjekt for intern bruk.