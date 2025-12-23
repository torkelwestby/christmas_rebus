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
      oslo: 'Oslo kommunevåpen på bildet',
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
      bislett: 'biceps minus sa (altså bissa som slang for biceps), pluss lett-restauranten',
    },
    description: 'Helmelk-julaften, vin-emoji, tyv som tar, og biceps-lett'
  },
  {
    id: 3,
    keywords: ['fransk', 'eventyrlig', 'michelin', 'mon', 'oncl'],
    fullAnswer: 'Fransk eventyrlig michelin opplevelse på mon oncl',
    hints: {
      fransk: 'fransk flagg',
      eventyrlig: 'eventyr-bilde pluss lig',
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
      øst: 'kompass med pil mot øst',
      oslo: 'Oslo kommune på bildet',
      spa: 'spade minus de',
      velvære: 'vel fra Brønnøya Vel, pluss været-nyhetene minus t',
      well: 'vel på engelsk igjen fra Brønnøya vel',
    },
    description: 'Dagsfylla-turmat, kompass øst, Oslo, spade, Brønnøya Vel og værmelding'
  },
  {
    id: 5,
    keywords: ['en', 'sliten', 'søndag', 'gule', 'måke'],
    fullAnswer: 'En sliten søndag på den gule måke',
    hints: {
      en: 'Jenny som er pen uten p',
      sliten: 'karakter fra Nissene i skjul som alltid er sliten',
      søndag: 'TV-serie med Atle Antonsen som heter søndag',
      gule: 'fargen gul ikon',
      måke: 'et bilde av en måke',
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

    // Bygg generell feedback basert på antall riktige/manglende
    const foundCount = foundKeywords.length;
    const totalCount = rebus.keywords.length;

    // IKKE send fasit-ord til AI - kun generell info
    let progressHint = '';
    if (foundCount === 0) {
      progressHint = 'Du har ikke funnet noen riktige elementer enda.';
    } else if (foundCount === 1) {
      progressHint = 'Du har funnet ett riktig element!';
    } else if (foundCount === totalCount - 1) {
      progressHint = 'Du er veldig nære! Kun ett element mangler.';
    } else if (foundCount > totalCount / 2) {
      progressHint = `Du er godt i gang! Du har ${foundCount} av ${totalCount} elementer.`;
    } else {
      progressHint = `Du har funnet ${foundCount} av ${totalCount} elementer.`;
    }

    // Generer mer spesifikk feedback UTEN å røpe fasit-ord
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du er en hjelpsom julenisse som gir feedback på rebus-svar.

KRITISK VIKTIG - ALDRI GJØR DETTE:
- ALDRI nevn ord fra fasit som brukeren ikke har skrevet
- ALDRI si "du mangler [ord fra fasit]"
- ALDRI gi direkte ord fra svaret
- ALDRI nevn spesifikke steder, navn eller ting fra fasit

I STEDET - GI INDIREKTE HINT:
- Hint til TYPER elementer: "kanskje mer om aktiviteten?", "hvor skal dette skje?"
- Hint til BILDENE: "se nøye på alle emoji-ene", "hva viser det siste bildet?"
- Hint til STRUKTUR: "tenk på hele setningen", "hva er stedet?"
- Vær morsom og julete

REBUS KONTEKST:
Rebusen viser: ${rebus.description}
Status: ${progressHint}

EKSEMPLER PÅ GOD FEEDBACK basert på fremgang:

Hvis 0 elementer funnet:
- "Oi da! Her må du se nøye på ALLE bildene fra topp til bunn. Kanskje starte med emoji-ene? 🎅"
- "Ho ho! Dette krever litt ekstra juletitt! Se grundig på hvert eneste bilde - hva forteller de deg? 🎄"

Hvis 1-2 elementer funnet:
- "God start! Du er på riktig vei, men det er mer å finne. Se nøye på de bildene du kanskje hoppet over! ⭐"
- "Bra! Men julenissen ser du mangler litt. Hva med resten av bildene? Kanskje noe om stedet? 🎅"

Hvis 3-4 elementer funnet:
- "Du er godt i gang! Nå mangler det bare litt. Se ekstra nøye på de siste bildene - hva representerer de? 🎄"
- "Så nære! Du har nesten alt. Kanskje se en gang til på bildene du ikke har brukt enda? ⭐"

Hvis kun 1 element mangler:
- "Nesten i mål! Du mangler bare ÉN liten ting. Hvilket bilde har du ikke brukt enda? 🎅"
- "SÅ nære julegaven! Kun ett element gjenstår. Se nøye på alle bildene - hvilket har du glemt? 🎄"

Generer nå en morsom julehilsen (MAX 2-3 setninger) som PASSER fremgangen, UTEN å røpe spesifikke ord.`,
        },
        {
          role: 'user',
          content: `Brukerens svar: "${userAnswer}"\n${progressHint}`,
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
