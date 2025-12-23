import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RebusTag = 'FOOD' | 'DRINK' | 'ACTIVITY' | 'PLACE' | 'VIBE' | 'TIME';

type RebusPart = {
  tag: RebusTag;
  keywords: string[];   // ord vi matcher som "treff"
  hintType: string;     // menneskelig kategori, brukes i hint (ikke fasitord)
};

type Rebus = {
  id: number;
  fullAnswer: string;   // fasitsetning (AI får vite den, men får ikke lov å lekke)
  description: string;  // generell kontekst om elementene
  parts: RebusPart[];
};

const REBUS_SOLUTIONS: Rebus[] = [
  {
    id: 1,
    fullAnswer: 'Pizza, øl og konkurranse på Oslo bowling',
    description: 'Pizza-emoji, øl-emoji, konkurs+r-anse, Oslo, og bowling-delen.',
    parts: [
      { tag: 'FOOD', keywords: ['pizza'], hintType: 'mat' },
      { tag: 'DRINK', keywords: ['øl'], hintType: 'drikke' },
      { tag: 'ACTIVITY', keywords: ['konkurranse'], hintType: 'aktivitet' },
      { tag: 'PLACE', keywords: ['oslo'], hintType: 'sted' },
      { tag: 'PLACE', keywords: ['bowling'], hintType: 'sted' },
    ],
  },
  {
    id: 2,
    fullAnswer: 'Helaften med vin og tartar på bislett',
    description: 'Helmelk minus melk + julaften minus jul, vin, tar x2, bis+lett.',
    parts: [
      { tag: 'TIME', keywords: ['helaften'], hintType: 'tidspunkt' },
      { tag: 'DRINK', keywords: ['vin'], hintType: 'drikke' },
      { tag: 'FOOD', keywords: ['tartar'], hintType: 'mat' },
      { tag: 'PLACE', keywords: ['bislett'], hintType: 'sted' },
    ],
  },
  {
    id: 3,
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    description: 'Frankrike-flagg, eventyr + lig, michelle(-le + in), mon(sen-), onkel.',
    parts: [
      { tag: 'VIBE', keywords: ['fransk'], hintType: 'stemning' },
      { tag: 'VIBE', keywords: ['eventyrlig'], hintType: 'stemning' },
      { tag: 'VIBE', keywords: ['michelin'], hintType: 'kvalitet' },
      { tag: 'PLACE', keywords: ['mon'], hintType: 'sted' },
      { tag: 'PLACE', keywords: ['oncl'], hintType: 'sted' },
    ],
  },
  {
    id: 4,
    fullAnswer: 'Dagstur øst for Oslo med spa og velvære på the Well',
    description: 'Dagstur, øst, Oslo, spa, velvære, the well.',
    parts: [
      { tag: 'TIME', keywords: ['dagstur'], hintType: 'tidspunkt' },
      { tag: 'PLACE', keywords: ['øst'], hintType: 'retning' },
      { tag: 'PLACE', keywords: ['oslo'], hintType: 'sted' },
      { tag: 'ACTIVITY', keywords: ['spa'], hintType: 'aktivitet' },
      { tag: 'VIBE', keywords: ['velvære'], hintType: 'stemning' },
      { tag: 'PLACE', keywords: ['well'], hintType: 'sted' },
    ],
  },
  {
    id: 5,
    fullAnswer: 'En sliten søndag på den gule måke',
    description: 'En, sliten, søndag, den gule måke (symbolsk).',
    parts: [
      { tag: 'TIME', keywords: ['søndag'], hintType: 'tidspunkt' },
      { tag: 'VIBE', keywords: ['sliten'], hintType: 'stemning' },
      { tag: 'PLACE', keywords: ['måke'], hintType: 'sted' },
    ],
  },
];

// ---------------- Utils ----------------
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'og', 'på', 'i', 'med', 'en', 'ei', 'et', 'den', 'det', 'de', 'til', 'for', 'av', 'som', 'da',
  'the', 'a', 'an', 'to', 'of', 'in', 'at',
]);

function tokenize(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  return t.split(' ').filter(w => w && !STOPWORDS.has(w));
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function humanizeTag(tag: RebusTag): string {
  switch (tag) {
    case 'FOOD': return 'mat';
    case 'DRINK': return 'drikke';
    case 'ACTIVITY': return 'aktivitet';
    case 'PLACE': return 'sted';
    case 'TIME': return 'tidspunkt';
    case 'VIBE': return 'stemning';
    default: return 'del';
  }
}

// ---------------- Evaluation ----------------
function evaluateRebus(rebus: Rebus, userAnswer: string) {
  const userTokens = tokenize(userAnswer);

  // Treffer basert på parts.keywords
  const hitWords: string[] = [];
  const hitParts: RebusPart[] = [];
  const missingParts: RebusPart[] = [];

  for (const part of rebus.parts) {
    const foundKeyword = part.keywords.find(k => userTokens.includes(normalizeText(k)));
    if (foundKeyword) {
      hitWords.push(foundKeyword);
      hitParts.push(part);
    } else {
      missingParts.push(part);
    }
  }

  // Bom: alle tokens brukeren skrev som ikke er treff og ikke finnes i løsningen
  // NB: Dette er "streng" bom. Hvis du vil være mildere kan du droppe solution-sjekken.
  const solutionTokens = tokenize(rebus.fullAnswer);
  const solutionSet = new Set(solutionTokens);

  const hitSet = new Set(hitWords.map(normalizeText));
  const bomWords = unique(userTokens.filter(w => !hitSet.has(w) && !solutionSet.has(w)));

  // Mangler: send kun kategorier, ikke ord
  const missingCategories = unique(missingParts.map(p => humanizeTag(p.tag)));

  const isCorrect = missingParts.length === 0;

  return {
    isCorrect,
    hitWords: unique(hitWords),
    bomWords,
    missingCategories,
    progress: { found: hitParts.length, total: rebus.parts.length },
  };
}

// ---------------- API ----------------
export async function POST(request: NextRequest) {
  try {
    const { rebusId, userAnswer } = await request.json();

    if (!rebusId || typeof userAnswer !== 'string') {
      return NextResponse.json({ error: 'Missing rebusId or userAnswer' }, { status: 400 });
    }

    const rebus = REBUS_SOLUTIONS.find(r => r.id === Number(rebusId));
    if (!rebus) {
      return NextResponse.json({ error: 'Invalid rebusId' }, { status: 400 });
    }

    const evaluation = evaluateRebus(rebus, userAnswer);

    if (evaluation.isCorrect) {
      return NextResponse.json({
        correct: true,
        message: '🎉 Gratulerer! Du har løst rebusen!',
        progress: evaluation.progress,
      });
    }

    const progressText =
      evaluation.progress.found === 0
        ? 'Du har ikke truffet noen av delene ennå'
        : evaluation.progress.found === evaluation.progress.total - 1
        ? 'Du er veldig nære – kun én del gjenstår'
        : `Du har truffet ${evaluation.progress.found} av ${evaluation.progress.total} deler`;

    // AI får full kontekst og ordlistene, men får ikke lov å nevne manglende ord
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
Du gir kort, konkret og litt morsom feedback på et rebus-svar.

DU FÅR:
- treffOrd: ord brukeren har skrevet som er riktige
- bomOrd: ord brukeren har skrevet som ikke hører hjemme
- manglerKategorier: typer som mangler (mat, drikke, aktivitet, sted, tidspunkt, stemning)
- userAnswer: hele svaret brukeren skrev
- solution: fasitsetningen (kun for deg)

KRITISKE REGLER:
1) Du har LOV til å sitere treffOrd og bomOrd eksplisitt.
2) Du har IKKE LOV til å skrive ord fra løsningen som brukeren ikke allerede har skrevet.
3) Du har IKKE LOV til å bruke direkte synonymer til ord som mangler.
4) Du skal hinte til mangler kun ved å beskrive TYPE (sted, aktivitet, mat, drikke, tidspunkt, stemning).
5) Maks 3 setninger. Maks 1 emoji.
6) Ikke gjenta hele brukerens svar.

STRUKTUR:
- Setning 1: Si konkret hva som er riktig (treffOrd) og gi ros for fremgang.
- Setning 2: Si konkret hva som er bom (bomOrd) med en lett spøk.
- Setning 3: Si hva slags kategorier som mangler (manglerKategorier) og be dem se etter disse i bildene.

Hvis treffOrd er tom: si at ingenting sitter ennå og foreslå én kategori å starte med.
Hvis bomOrd er tom: hopp over setning 2.
Hvis kun én kategori mangler: gjør det tydelig at det er akkurat den kategorien.

Kontekst om rebusen (bilder/elementer): ${rebus.description}
Fremgang: ${progressText}
          `.trim(),
        },
        {
          role: 'user',
          content: JSON.stringify({
            treffOrd: evaluation.hitWords,
            bomOrd: evaluation.bomWords,
            manglerKategorier: evaluation.missingCategories,
            userAnswer,
            solution: rebus.fullAnswer,
          }),
        },
      ],
      temperature: 0.7,
      max_tokens: 140,
    });

    const feedback =
      completion.choices[0]?.message?.content ||
      'Ikke helt ennå. Se en gang til på alle elementene og prøv igjen.';

    return NextResponse.json({
      correct: false,
      message: feedback,
      progress: evaluation.progress,
      debug: {
        // Fjern i prod hvis du ikke vil eksponere disse
        treffOrd: evaluation.hitWords,
        bomOrd: evaluation.bomWords,
        manglerKategorier: evaluation.missingCategories,
      },
    });
  } catch (error) {
    console.error('Error checking rebus:', error);
    return NextResponse.json({ error: 'Failed to check rebus' }, { status: 500 });
  }
}
