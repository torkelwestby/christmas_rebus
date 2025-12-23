import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Rebus-struktur:
 * - parts representerer semantiske deler av setningen
 * - keywords brukes kun til matching, IKKE til hint direkte
 * - hintStyle beskriver HVA noe er, ikke hva det heter
 */
type RebusPart = {
  tag: 'FOOD' | 'DRINK' | 'ACTIVITY' | 'PLACE' | 'VIBE' | 'TIME';
  keywords: string[];
  hintStyle: string;
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
    description: 'Pizza-emoji, øl-emoji, konkurs-ransel-bildet, Oslo, og bowling-delen',
    parts: [
      { tag: 'FOOD', keywords: ['pizza'], hintStyle: 'noe man spiser, ofte delt i biter' },
      { tag: 'DRINK', keywords: ['øl'], hintStyle: 'noe man drikker, ofte i glass' },
      { tag: 'ACTIVITY', keywords: ['konkurranse'], hintStyle: 'noe der man måler seg mot andre eller spiller mot noen' },
      { tag: 'PLACE', keywords: ['oslo'], hintStyle: 'en kjent by og hovedstad' },
      { tag: 'PLACE', keywords: ['bowling'], hintStyle: 'et sted der kuler ruller og poeng telles' },
    ],
  },
  {
    id: 2,
    fullAnswer: 'Helaften med vin og tartar på bislett',
    description: 'Helmelk, julaften, vin, tyv som tar, biceps og Lett-restaurant',
    parts: [
      { tag: 'TIME', keywords: ['helaften'], hintStyle: 'noe som varer hele kvelden' },
      { tag: 'DRINK', keywords: ['vin'], hintStyle: 'noe som ofte serveres i glass til mat' },
      { tag: 'FOOD', keywords: ['tartar'], hintStyle: 'en rett laget av noe rått, ofte delt i små biter' },
      { tag: 'PLACE', keywords: ['bislett'], hintStyle: 'et område i byen, kjent for idrett og trening' },
    ],
  },
  {
    id: 3,
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    description: 'Frankrike-flagg, eventyr, Michelle Obama, Lars Monsen, og onkel',
    parts: [
      { tag: 'VIBE', keywords: ['fransk'], hintStyle: 'noe med utenlandsk preg, ofte assosiert med mat og kultur' },
      { tag: 'VIBE', keywords: ['eventyrlig'], hintStyle: 'noe som føles spesielt, nesten som et eventyr' },
      { tag: 'VIBE', keywords: ['michelin'], hintStyle: 'noe som handler om svært høy kvalitet på mat' },
      { tag: 'PLACE', keywords: ['mon'], hintStyle: 'første del av et navn, bygget ved å fjerne noe' },
      { tag: 'PLACE', keywords: ['oncl'], hintStyle: 'andre del av navnet, uttales som et familiemedlem' },
    ],
  },
  {
    id: 4,
    fullAnswer: 'Dagstur øst for Oslo med spa og velvære på the Well',
    description: 'Dagsfylla, turmat, kompass øst, Oslo, spade, Brønnøya Vel og værmelding',
    parts: [
      { tag: 'TIME', keywords: ['dagstur'], hintStyle: 'en kort tur som ikke varer over natten' },
      { tag: 'PLACE', keywords: ['øst'], hintStyle: 'en retning, vist med kompass eller pil' },
      { tag: 'PLACE', keywords: ['oslo'], hintStyle: 'byen man reiser fra' },
      { tag: 'ACTIVITY', keywords: ['spa'], hintStyle: 'noe som handler om ro, varme og avslapning' },
      { tag: 'VIBE', keywords: ['velvære'], hintStyle: 'noe som handler om å føle seg bra' },
      { tag: 'PLACE', keywords: ['well'], hintStyle: 'et sted med engelsk navn, knyttet til avslapning' },
    ],
  },
  {
    id: 5,
    fullAnswer: 'En sliten søndag på den gule måke',
    description: 'Jenny (pen), Nissene i skjul, Søndag-serien og gul måke',
    parts: [
      { tag: 'TIME', keywords: ['søndag'], hintStyle: 'en dag i helgen' },
      { tag: 'VIBE', keywords: ['sliten'], hintStyle: 'følelsen av å være trøtt eller ferdig med uka' },
      { tag: 'PLACE', keywords: ['måke'], hintStyle: 'et dyr man ofte ser ved sjøen, her brukt symbolsk' },
    ],
  },
];

// --- Utils ---
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, '')
    .trim();
}

// --- API ---
export async function POST(request: NextRequest) {
  try {
    const { rebusId, userAnswer } = await request.json();

    if (!rebusId || !userAnswer) {
      return NextResponse.json({ error: 'Missing rebusId or userAnswer' }, { status: 400 });
    }

    const rebus = REBUS_SOLUTIONS.find(r => r.id === rebusId);
    if (!rebus) {
      return NextResponse.json({ error: 'Invalid rebusId' }, { status: 400 });
    }

    const normalizedAnswer = normalizeText(userAnswer);
    const answerWords = normalizedAnswer.split(/\s+/);

    const foundParts: RebusPart[] = [];
    const missingParts: RebusPart[] = [];

    for (const part of rebus.parts) {
      const found = part.keywords.some(k =>
        answerWords.some(w =>
          w === normalizeText(k) ||
          w.includes(normalizeText(k)) ||
          normalizeText(k).includes(w)
        )
      );

      if (found) foundParts.push(part);
      else missingParts.push(part);
    }

    if (missingParts.length === 0) {
      return NextResponse.json({
        correct: true,
        message: '🎉 Gratulerer! Du har låst opp denne opplevelsen for 2026!',
      });
    }

    // Progress tekst (kun tall, ikke ord)
    const progressText =
      foundParts.length === 0
        ? 'Ingen deler funnet ennå'
        : foundParts.length === rebus.parts.length - 1
        ? 'Kun én del mangler'
        : `Funnet ${foundParts.length} av ${rebus.parts.length} deler`;

    // AI-feedback
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
Du gir korte, vennlige hint til en rebus.

DU HAR FULL KUNNSKAP OM FASIT, MEN DU MÅ FØLGE DISSE REGLENE:
- Aldri skriv eller bruk fasitord som brukeren ikke selv har skrevet.
- Aldri nevne konkrete steder, navn eller objekter direkte.
- Bruk kun assosiative, menneskelige beskrivelser.
- Maks 2–3 setninger.
- Maks én emoji.

DU KAN:
- Bekrefte fremgang.
- Hinte til hva slags TYPE ting som mangler (sted, aktivitet, stemning).
- Beskrive funksjon eller bruk (f.eks. “noe man bærer på ryggen”).

KONTEKST:
Rebusen viser: ${rebus.description}
Fremgang: ${progressText}

Mangler disse typene deler:
${missingParts.map(p => `- ${p.tag}: ${p.hintStyle}`).join('\n')}

Gi nå en kort, vennlig feedback som hjelper brukeren videre uten å røpe noe.
          `,
        },
        {
          role: 'user',
          content: userAnswer,
        },
      ],
      temperature: 0.8,
      max_tokens: 120,
    });

    const feedback =
      completion.choices[0]?.message?.content ||
      'Hmm, ikke helt riktig ennå. Se nøye på alle bildene og prøv igjen!';

    return NextResponse.json({
      correct: false,
      message: feedback,
      progress: {
        found: foundParts.length,
        total: rebus.parts.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to check rebus' }, { status: 500 });
  }
}