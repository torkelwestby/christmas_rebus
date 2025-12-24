import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RebusTag = 'FOOD' | 'DRINK' | 'ACTIVITY' | 'PLACE' | 'VIBE' | 'TIME';

type RebusPart = {
  tag: RebusTag;
  keywords: string[];   // ord som teller som treff
  hintType: string;     // menneskelig kategori, brukes kun i hint
};

type Rebus = {
  id: number;
  fullAnswer: string;   // fasit (AI kjenner den, men får ikke lov å lekke)
  description: string;  // kontekst om bilder/elementer
  parts: RebusPart[];
};

const REBUS_SOLUTIONS: Rebus[] = [
  {
    id: 1,
    fullAnswer: 'Pizza, øl og konkurranse på Oslo bowling',
    description: 'Pizza-emoji, øl-emoji, konkurranse, Oslo og bowling.',
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
    description: 'Helmelk/julaften, vin, tartar og Bislett.',
    parts: [
      { tag: 'TIME', keywords: ['helaften'], hintType: 'opplegg' },
      { tag: 'DRINK', keywords: ['vin'], hintType: 'drikke' },
      { tag: 'FOOD', keywords: ['tartar'], hintType: 'mat' },
      { tag: 'PLACE', keywords: ['bislett'], hintType: 'sted' },
    ],
  },
  {
    id: 3,
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    description: 'Frankrike, eventyr, Michelin og Mon Oncl.',
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
    description: 'Dagstur, øst, Oslo, spa, velvære og The Well.',
    parts: [
      { tag: 'TIME', keywords: ['dagstur'], hintType: 'opplegg' },
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
    description: 'Søndag, sliten stemning og den gule måka.',
    parts: [
      { tag: 'TIME', keywords: ['søndag'], hintType: 'opplegg' },
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
  'og','på','i','med','en','ei','et','den','det','de','til','for','av','som','da',
  'the','a','an','to','of','in','at',
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
    case 'TIME': return 'opplegg';     // viktig endring
    case 'VIBE': return 'stemning';
    default: return 'del';
  }
}

// ---------------- Evaluation ----------------
function evaluateRebus(rebus: Rebus, userAnswer: string) {
  const userTokens = tokenize(userAnswer);

  const hitWords: string[] = [];
  const hitParts: RebusPart[] = [];
  const missingParts: RebusPart[] = [];

  for (const part of rebus.parts) {
    const found = part.keywords.find(k => userTokens.includes(normalizeText(k)));
    if (found) {
      hitWords.push(found);
      hitParts.push(part);
    } else {
      missingParts.push(part);
    }
  }

  const solutionTokens = tokenize(rebus.fullAnswer);
  const solutionSet = new Set(solutionTokens);
  const hitSet = new Set(hitWords.map(normalizeText));

  const bomWords = unique(
    userTokens.filter(w => !hitSet.has(w) && !solutionSet.has(w))
  );

  const missingCategories = unique(missingParts.map(p => humanizeTag(p.tag)));

  return {
    isCorrect: missingParts.length === 0,
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
        message: '🎄 Gratulerer! Du har knekt rebusen og låst opp opplevelsen!',
        progress: evaluation.progress,
      });
    }

    const progressText =
      evaluation.progress.found === 0
        ? 'Ingen riktige deler ennå'
        : evaluation.progress.found === evaluation.progress.total - 1
        ? 'Du er veldig nære – kun én del mangler'
        : `Du har funnet ${evaluation.progress.found} av ${evaluation.progress.total} deler`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
Du gir kort, konkret og litt julete feedback på et rebus-svar.

DU FÅR:
- treffOrd: riktige ord brukeren har skrevet
- bomOrd: ord som ikke passer inn
- manglerKategorier: typer som mangler (mat, drikke, aktivitet, sted, opplegg, stemning)
- userAnswer: hele brukerens svar
- solution: fasitsetningen (kun for deg)

REGLER:
1) Du har LOV til å sitere treffOrd og bomOrd.
2) Du har IKKE LOV til å skrive ord som brukeren ikke allerede har skrevet.
3) Du skal kun hinte til mangler via TYPE, ikke konkrete ord.
4) 2–3 setninger. Maks 1 emoji.
5) Litt julete tone er lov, men ikke rollespill.

STRUKTUR:
- Setning 1: Si tydelig hva som er riktig (treffOrd).
- Setning 2: Kommenter bom (bomOrd) på en lett og gøyal måte.
- Setning 3: Forklar hva slags typer som mangler (manglerKategorier) og be brukeren se på disse elementene i rebusen.

Hvis treffOrd er tom: si at ingenting sitter ennå og foreslå én kategori å starte med.
Hvis bomOrd er tom: hopp over setning 2.
Hvis kun én kategori mangler: gjør det tydelig.

Kontekst om rebusen: ${rebus.description}
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

    return NextResponse.json({
      correct: false,
      message:
        completion.choices[0]?.message?.content ??
        'Ikke helt ennå. Ta en titt til på alle bildene og prøv igjen 🎅',
      progress: evaluation.progress,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to check rebus' }, { status: 500 });
  }
}