import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fasit og hint for hver rebus
const REBUS_SOLUTIONS = [
  {
    id: 1,
    keywords: ['pizza', 'øl', 'konkurranse', 'oslo', 'bowling'],
    fullAnswer: 'Pizza, øl og konkurranse på Oslo bowling',
    hints: {
      pizza: 'pizzaemoji på bildet',
      øl: 'ølemoji på bildet',
      konkurranse: 'konkurs minus s, pluss ransel minus l',
      oslo: 'Oslo på bildet',
      bowling: 'bosted minus sted, pluss w, pluss riesling minus ris',
    },
    description: 'Pizza-emoji, øl-emoji, konkurs-ransel-bildet, Oslo, og bowling-delen'
  },
  {
    id: 2,
    keywords: ['helaften', 'vin', 'tartar', 'bislett'],
    fullAnswer: 'Helaften med vin og tartar på bislett',
    hints: {
      helaften: 'helmelk minus melk, pluss julaften minus jul',
      vin: 'vinemoji',
      tartar: 'tyv-bildet som tar brukt to ganger',
      bislett: 'biceps minus sa, pluss lett-restauranten',
    },
    description: 'Helmelk-julaften, vin-emoji, tyv som tar, og biceps-lett'
  },
  {
    id: 3,
    keywords: ['fransk', 'eventyrlig', 'michelin', 'mon', 'oncl'],
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    hints: {
      fransk: 'fransk flagg',
      eventyrlig: 'eventyr pluss lig',
      michelin: 'Michelle Obama minus le pluss in',
      mon: 'Lars Monsen minus sen',
      oncl: 'onkel (fonetisk)',
    },
    description: 'Frankrike-flagg, eventyr, Michelle Obama, Lars Monsen, og onkel'
  },
  {
    id: 4,
    keywords: ['dagstur', 'øst', 'oslo', 'spa', 'velvære', 'well'],
    fullAnswer: 'Dagstur øst for Oslo med spa og velvære på the Well',
    hints: {
      dagstur: 'dagsfylla minus fylla, pluss turmat minus mat',
      øst: 'kompass som peker øst',
      oslo: 'Oslo på bildet',
      spa: 'spade minus de',
      velvære: 'vel fra Brønnøya Vel, pluss værmelding minus t',
      well: 'vel på engelsk',
    },
    description: 'Dagsfylla-turmat, kompass øst, Oslo, spade, Brønnøya Vel og værmelding'
  },
  {
    id: 5,
    keywords: ['sliten', 'søndag', 'gule', 'måke'],
    fullAnswer: 'En sliten søndag på den gule måke',
    hints: {
      sliten: 'karakter fra Nissene i skjul som alltid er sliten',
      søndag: 'TV-serie med Atle Antonsen',
      gule: 'fargen på måken',
      måke: 'fuglen på bildet (McDonald\'s)',
    },
    description: 'Jenny (pen), Nissene i skjul, Søndag-serien, og gul måke'
  },
];

// Normaliserer tekst for sammenligning
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, '')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { rebusId, userAnswer } = await request.json();

    if (!rebusId || !userAnswer) {
      return NextResponse.json(
        { error: 'Missing rebusId or userAnswer' },
        { status: 400 }
      );
    }

    const rebus = REBUS_SOLUTIONS.find(r => r.id === rebusId);
    if (!rebus) {
      return NextResponse.json(
        { error: 'Invalid rebusId' },
        { status: 400 }
      );
    }

    const normalizedAnswer = normalizeText(userAnswer);

    // Split i ord for bedre matching
    const answerWords = normalizedAnswer.split(/\s+/);

    // Sjekk hvilke nøkkelord som finnes i svaret
    // Må være eksakte ord-match, ikke bare substring
    const missingKeywords: string[] = [];
    const foundKeywords: string[] = [];

    for (const keyword of rebus.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      // Sjekk om keyword finnes som komplett ord i svaret
      // Tillat at keyword er del av et lengre ord hvis det er sammensatt
      const isFound = answerWords.some(word =>
        word === normalizedKeyword || // eksakt match
        (normalizedKeyword.length > 3 && word.includes(normalizedKeyword)) || // substring for lengre ord
        (word.length > 3 && normalizedKeyword.includes(word) && word.length >= normalizedKeyword.length * 0.8) // fuzzy match
      );

      if (isFound) {
        foundKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    }

    const isCorrect = missingKeywords.length === 0;

    if (isCorrect) {
      return NextResponse.json({
        correct: true,
        message: '🎉 Gratulerer! Du har låst opp denne opplevelsen for 2026!',
      });
    }

    // Bygg hint-tekst basert på hva som mangler
    const hintTexts = missingKeywords.map(keyword => {
      const hint = rebus.hints[keyword as keyof typeof rebus.hints];
      return `${keyword}: ${hint}`;
    }).join('\n');

    // Generer mer spesifikk feedback
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du er en hjelpsom julenisse som gir feedback på rebus-svar.

VIKTIG RETNINGSLINJER:
- Gi konkret feedback på hva brukeren har riktig og hva som mangler uten å noen gang røpe ordene direkte
- IKKE røp svaret direkte, men hint diskret til elementene i rebusen
- Vær kortfattet (2-3 setninger MAX)
- Vær morsom og julete
- Ikke vær for ledende - bruk metaforer og indirekte hint

REBUS KONTEKST:
Rebus inneholder: ${rebus.description}

Brukerens svar: "${userAnswer}"
Riktig svar: "${rebus.fullAnswer}"

Brukeren har funnet: ${foundKeywords.length > 0 ? foundKeywords.join(', ') : 'ingen riktige ord enda'}
Brukeren mangler: ${missingKeywords.join(', ')}

HINT til manglende elementer (IKKE gi disse direkte, men hint til dem):
${hintTexts}

EKSEMPLER PÅ GOD FEEDBACK:
- Hvis de har "pizza" og "øl" men mangler resten: "Ho ho! God start med maten og drikken 🍕🍺 Men hvor skal dette skje? Tenk på sport og hovedstad!"
- Hvis de mangler alt: "Oi da! Her må du se nøye på alle bildene. Start med emoji-ene, kanskje? 🎅"
- Hvis de har nesten alt: "Så nære! Du har nesten alt, men kanskje du må se ekstra nøye på [hint til siste element]? ⭐"

Generer nå en morsom julehilsen (MAX 2-3 setninger) basert på hva brukeren mangler.`,
        },
        {
          role: 'user',
          content: `Brukerens svar: "${userAnswer}"`,
        },
      ],
      temperature: 0.8,
      max_tokens: 120,
    });

    const feedback = completion.choices[0]?.message?.content ||
      '❄️ Hmm, ikke helt riktig ennå! Se nøye på bildene og prøv igjen! 🎄';

    return NextResponse.json({
      correct: false,
      message: feedback,
      hint: {
        totalKeywords: rebus.keywords.length,
        foundKeywords: foundKeywords.length,
        missingCount: missingKeywords.length,
      }
    });

  } catch (error) {
    console.error('Error checking rebus:', error);
    return NextResponse.json(
      { error: 'Failed to check answer' },
      { status: 500 }
    );
  }
}
