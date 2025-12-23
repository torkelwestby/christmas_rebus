import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RebusPart = {
  tag: 'FOOD' | 'DRINK' | 'ACTIVITY' | 'PLACE' | 'VIBE' | 'TIME';
  keywords: string[];
  hintStyle: string;
  nearMiss?: string[]; // ord som er "nære", men feil
};

type Rebus = {
  id: number;
  fullAnswer: string;
  description: string;
  parts: RebusPart[];
};

const REBUS_SOLUTIONS: Rebus[] = [
  {
    id: 1,
    fullAnswer: 'Pizza, øl og konkurranse på Oslo bowling',
    description: 'Pizza-emoji, øl-emoji, konkurs-ransel, Oslo, bowling',
    parts: [
      { tag: 'FOOD', keywords: ['pizza'], hintStyle: 'mat man ofte deler i biter' },
      { tag: 'DRINK', keywords: ['øl'], hintStyle: 'noe man drikker, ofte i glass' },
      {
        tag: 'ACTIVITY',
        keywords: ['konkurranse'],
        hintStyle: 'spill eller kamp der man måler seg mot andre',
        nearMiss: ['spill', 'lek', 'dart', 'biljard'],
      },
      { tag: 'PLACE', keywords: ['oslo'], hintStyle: 'en kjent by og hovedstad' },
      {
        tag: 'PLACE',
        keywords: ['bowling'],
        hintStyle: 'et sted der man spiller med store kuler',
        nearMiss: ['dart', 'biljard'],
      },
    ],
  },
  {
    id: 2,
    fullAnswer: 'Helaften med vin og tartar på bislett',
    description: 'Helmelk, julaften, vin, tyv som tar, biceps, Lett',
    parts: [
      { tag: 'TIME', keywords: ['helaften'], hintStyle: 'noe som varer hele kvelden' },
      { tag: 'DRINK', keywords: ['vin'], hintStyle: 'drikke som ofte serveres til middag' },
      {
        tag: 'FOOD',
        keywords: ['tartar'],
        hintStyle: 'rett laget av noe rått, ofte hakket',
        nearMiss: ['biff', 'kjøtt', 'carpaccio'],
      },
      { tag: 'PLACE', keywords: ['bislett'], hintStyle: 'område i byen, kjent for idrett' },
    ],
  },
  {
    id: 3,
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    description: 'Frankrike, eventyr, Michelin, Mon Oncl',
    parts: [
      { tag: 'VIBE', keywords: ['fransk'], hintStyle: 'utenlandsk preg, mye kultur og mat' },
      { tag: 'VIBE', keywords: ['eventyrlig'], hintStyle: 'noe som føles ekstra spesielt' },
      {
        tag: 'VIBE',
        keywords: ['michelin'],
        hintStyle: 'ekstremt høy kvalitet på mat',
        nearMiss: ['fin', 'dyr', 'gourmet'],
      },
      { tag: 'PLACE', keywords: ['mon'], hintStyle: 'første del av et navn' },
      { tag: 'PLACE', keywords: ['oncl'], hintStyle: 'andre del, høres ut som et familiemedlem' },
    ],
  },
  {
    id: 4,
    fullAnswer: 'Dagstur øst for Oslo med spa og velvære på the Well',
    description: 'Dagstur, øst, Oslo, spa, velvære, Well',
    parts: [
      { tag: 'TIME', keywords: ['dagstur'], hintStyle: 'kort tur uten overnatting' },
      { tag: 'PLACE', keywords: ['øst'], hintStyle: 'en retning' },
      { tag: 'PLACE', keywords: ['oslo'], hintStyle: 'byen man reiser fra' },
      {
        tag: 'ACTIVITY',
        keywords: ['spa'],
        hintStyle: 'avslapning, varme, basseng',
        nearMiss: ['bad', 'svømmehall'],
      },
      { tag: 'VIBE', keywords: ['velvære'], hintStyle: 'å føle seg bra' },
      { tag: 'PLACE', keywords: ['well'], hintStyle: 'sted med engelsk navn' },
    ],
  },
  {
    id: 5,
    fullAnswer: 'En sliten søndag på den gule måke',
    description: 'Sliten, søndag, gul måke',
    parts: [
      { tag: 'TIME', keywords: ['søndag'], hintStyle: 'en dag i helgen' },
      { tag: 'VIBE', keywords: ['sliten'], hintStyle: 'trøtt og ferdig med uka' },
      {
        tag: 'PLACE',
        keywords: ['måke'],
        hintStyle: 'en fugl, her brukt symbolsk',
        nearMiss: ['burger', 'fastfood'],
      },
    ],
  },
];

// ---------------- Utils ----------------
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, '')
    .trim();
}

// ---------------- API ----------------
export async function POST(request: NextRequest) {
  const { rebusId, userAnswer } = await request.json();

  const rebus = REBUS_SOLUTIONS.find(r => r.id === rebusId);
  if (!rebus) {
    return NextResponse.json({ error: 'Invalid rebusId' }, { status: 400 });
  }

  const words = normalizeText(userAnswer).split(/\s+/);

  const found: RebusPart[] = [];
  const missing: RebusPart[] = [];
  const nearHits: RebusPart[] = [];

  for (const part of rebus.parts) {
    const exact = part.keywords.some(k => words.includes(normalizeText(k)));
    const near = part.nearMiss?.some(n => words.includes(normalizeText(n)));

    if (exact) found.push(part);
    else if (near) nearHits.push(part);
    else missing.push(part);
  }

  if (missing.length === 0) {
    return NextResponse.json({
      correct: true,
      message: '🎉 Gratulerer! Du har løst rebusen!',
    });
  }

  // --- Deterministisk status ---
  const summary = {
    found: found.map(p => p.tag),
    near: nearHits.map(p => p.tag),
    missing: missing.map(p => p.tag),
  };

  // --- AI: kun formulering ---
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `
Du formulerer feedback på en rebus.

REGLER:
- Aldri skriv fasitord.
- Ikke rett brukeren eksplisitt.
- Bruk deterministisk status som sannhet.
- Vær konkret, men ikke avslørende.
- 2–3 setninger, maks én emoji.

STATUS:
Riktig funnet: ${summary.found.join(', ') || 'ingenting'}
Nære forsøk: ${summary.near.join(', ') || 'ingen'}
Manglende deler: ${summary.missing.join(', ')}

BESKRIVELSE AV REBUS:
${rebus.description}

Oppgave:
1) Si tydelig hva brukeren har fått til.
2) Kommenter evt. nære bom (f.eks. feil type spill).
3) Pek konkret på hva som mangler (kategori + hintStyle).
`,
      },
      { role: 'user', content: userAnswer },
    ],
    temperature: 0.6,
    max_tokens: 120,
  });

  return NextResponse.json({
    correct: false,
    message:
      completion.choices[0]?.message?.content ??
      'Du er inne på noe, men mangler fortsatt noen deler.',
  });
}