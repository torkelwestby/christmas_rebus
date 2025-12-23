// src/app/api/ai-analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 30; // Max 30 seconds for AI analysis

// App Router: Next.js 14 default body size is 4MB
// Our compressed images are ~500KB, so this is plenty

// Rate limit
const userRequests = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_HOUR = Number(process.env.AI_MAX_REQ_PER_HOUR || 10);
const HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = userRequests.get(key);

  if (!entry || entry.resetAt < now) {
    userRequests.set(key, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_HOUR) return false;

  entry.count++;
  return true;
}

if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of userRequests.entries()) {
      if (v.resetAt < now) userRequests.delete(k);
    }
  }, 10 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.AI_ANALYZE_ENABLED === 'false') {
      return NextResponse.json({ error: 'AI er skrudd av i dette miljøet' }, { status: 503 });
    }

    const clientIp =
      // @ts-ignore
      request.ip ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(String(clientIp))) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen om litt.' },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI-tjenesten er ikke konfigurert' },
        { status: 500 }
      );
    }

    const { imageUrl, imageDataUrl, comment } = await request.json();

    // NY: Tillat tekst, bilde eller begge
    const hasText = typeof comment === 'string' && comment.trim().length > 0;
    const hasImage = Boolean(imageDataUrl || imageUrl);

    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: 'Legg ved beskrivelse eller bilde' },
        { status: 400 }
      );
    }

    // Sett kilde for bilde hvis finnes
    const imageSource = imageDataUrl || imageUrl || null;

    const openai = new OpenAI({ apiKey });

    // NY: Nøytral brukerinstruks som funker for alle kombinasjoner
    let userText = 'Analyser innholdet og foreslå felter.';
    if (hasText) {
      userText += `\n\nBeskrivelse fra bruker: ${comment.trim()}`;
    }

    // Bygg messages dynamisk
    const userContent: any[] = [{ type: 'text', text: userText }];
    if (hasImage && imageSource) {
      userContent.push({ type: 'image_url', image_url: { url: imageSource, detail: 'low' } });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
`Du er innovasjonsrådgiver for BAMA, Norges ledende grossist av frukt og grønt.
Du får enten tekst, bilde, eller begge. Gi en kort, konkret og forretningsrelevant vurdering.

Retningslinjer:
- Tittel: maks 8 ord
- Beskrivelse: 2–3 setninger
- Målgruppe: 1–2 setninger
- Behov/Problem: 1–2 setninger
- Verdiforslag: 1–2 setninger

Formater alltid som gyldig JSON:
{
  "title": "...",
  "description": "...",
  "targetAudience": "...",
  "needsProblem": "...",
  "valueProposition": "..."
}`
        },
        { role: 'user', content: userContent }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Ingen respons fra AI');

    let analysis: any;
    try {
      const clean = content.replace(/```json\s*|\s*```/g, '').trim();
      analysis = JSON.parse(clean);
    } catch {
      console.error('Could not parse JSON from model:', content);
      throw new Error('Kunne ikke tolke AI-responsen');
    }

    if (!analysis.title || !analysis.description) {
      throw new Error('Ufullstendig AI-respons');
    }

    return NextResponse.json({
      success: true,
      analysis: {
        title: analysis.title || '',
        description: analysis.description || '',
        targetAudience: analysis.targetAudience || '',
        needsProblem: analysis.needsProblem || '',
        valueProposition: analysis.valueProposition || ''
      },
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (err: any) {
    console.error('AI analyze error:', err);

    if (err?.status === 429 && (err?.code === 'insufficient_quota' || err?.error?.code === 'insufficient_quota')) {
      return NextResponse.json(
        { error: 'AI-kvoten er brukt opp i prosjektet. Aktiver billing eller øk grensen.' },
        { status: 429 }
      );
    }
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'Litt mange forespørsler akkurat nå. Prøv igjen straks.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: err?.message || 'AI-analyse feilet' },
      { status: 500 }
    );
  }
}
