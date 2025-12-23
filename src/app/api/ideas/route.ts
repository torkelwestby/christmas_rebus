// src/app/api/ideas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { airtableFetch, AirtableError } from '@/lib/airtable';
import { ideaSchema, AIRTABLE_FIELDS } from '@/lib/schemas';
import { checkRateLimit } from '@/lib/ratelimit';

// Helper to normalize stage names
const normalizeStage = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const n = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!n) return undefined;
  if (['idegenerering','ide gen','idegen','idegen'].includes(n)) return 'Idégenerering';
  if (['ideutforsking','utforsking'].includes(n)) return 'Idéutforsking';
  if (['problem/losning','problem losning','problem løsning','problem/løsning','problemlosning','problemloesning'].includes(n)) return 'Problem/Løsning';
  if (['produkt/marked','produkt marked'].includes(n)) return 'Produkt/Marked';
  if (['skalering'].includes(n)) return 'Skalering';
  if (['arkivert'].includes(n)) return 'Arkivert';
  const canonical = ['Idégenerering','Idéutforsking','Problem/Løsning','Produkt/Marked','Skalering','Arkivert'];
  if (canonical.includes(raw)) return raw;
  return undefined;
};

// GET /api/ideas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requested = parseInt(searchParams.get('max') || '100', 10);
    const maxRecords = Number.isFinite(requested) ? Math.max(1, requested) : 100;
    const pageSize = Math.min(maxRecords, 100);

    const params: Record<string, string | number | boolean> = {
      maxRecords,
      pageSize,
      returnFieldsByFieldId: true,
    };
    
    const offset = searchParams.get('offset') || undefined;
    if (offset) params.offset = offset;

    const data = await airtableFetch<{ records: any[]; offset?: string }>(
      '',
      { 
        method: 'GET', 
        params,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('GET /api/ideas error:', error);
    if (error instanceof AirtableError) {
      return NextResponse.json(
        { error: 'Kunne ikke hente ideer fra database' },
        { status: error.status >= 500 ? 503 : error.status }
      );
    }
    return NextResponse.json(
      { error: 'En feil oppstod ved henting av ideer' },
      { status: 500 }
    );
  }
}

// POST /api/ideas
export async function POST(request: NextRequest) {
  console.log('env adminU:', JSON.stringify(process.env.APP_USERNAME));
  console.log('env adminP set:', !!process.env.APP_PASSWORD);

  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Vennligst vent litt.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Clean empty strings
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );

    // Normalize stage
    const normStage = normalizeStage((cleanedBody as any).stage);
    if (normStage) (cleanedBody as any).stage = normStage;
    else delete (cleanedBody as any).stage;
    
    // Validate
    const validatedData = ideaSchema.parse(cleanedBody);

    // Build Airtable record
    const fields: Record<string, any> = {
      [AIRTABLE_FIELDS.TITLE]: validatedData.title,
      [AIRTABLE_FIELDS.DATE_SUBMITTED]: new Date().toISOString().split('T')[0],
    };

    // Optional fields
    if (validatedData.description) {
      fields[AIRTABLE_FIELDS.DESCRIPTION] = validatedData.description;
    }
    if (validatedData.type) {
      fields[AIRTABLE_FIELDS.TYPE] = validatedData.type;
    }
    if (validatedData.submitter) {
      fields[AIRTABLE_FIELDS.SUBMITTER] = validatedData.submitter;
    }
    if (validatedData.stage) {
      fields[AIRTABLE_FIELDS.STAGE] = validatedData.stage;
    }
    if (validatedData.targetAudience) {
      fields[AIRTABLE_FIELDS.TARGET_AUDIENCE] = validatedData.targetAudience;
    }
    if (validatedData.needsProblem) {
      fields[AIRTABLE_FIELDS.NEEDS_PROBLEM] = validatedData.needsProblem;
    }
    if (validatedData.valueProposition) {
      fields[AIRTABLE_FIELDS.VALUE_PROPOSITION] = validatedData.valueProposition;
    }

    // Ratings
    if (validatedData.strategicFit) {
      fields[AIRTABLE_FIELDS.STRATEGIC_FIT] = validatedData.strategicFit;
    }
    if (validatedData.consumerNeed) {
      fields[AIRTABLE_FIELDS.CONSUMER_NEED] = validatedData.consumerNeed;
    }
    if (validatedData.businessPotential) {
      fields[AIRTABLE_FIELDS.BUSINESS_POTENTIAL] = validatedData.businessPotential;
    }
    if (validatedData.feasibility) {
      fields[AIRTABLE_FIELDS.FEASIBILITY] = validatedData.feasibility;
    }
    if (validatedData.launchTime) {
      fields[AIRTABLE_FIELDS.LAUNCH_TIME] = validatedData.launchTime;
    }

    // Handle images from base64
    const imageBase64 = (body as any).imageBase64;
    const imageFilename = (body as any).imageFilename;
    const imagesBase64 = (body as any).imagesBase64;

    if (imageBase64 && imageFilename) {
      // Single image
      fields[AIRTABLE_FIELDS.IMAGE] = [{
        filename: imageFilename,
        url: `data:image/jpeg;base64,${imageBase64}`
      }];
    } else if (imagesBase64 && Array.isArray(imagesBase64) && imagesBase64.length > 0) {
      // Multiple images
      fields[AIRTABLE_FIELDS.IMAGE] = imagesBase64.map((img: any) => ({
        filename: img.filename,
        url: `data:image/jpeg;base64,${img.data}`
      }));
    } else if (validatedData.imageUrls && validatedData.imageUrls.length > 0) {
      // Legacy URL support
      fields[AIRTABLE_FIELDS.IMAGE] = validatedData.imageUrls.map((url, index) => ({
        url,
        filename: `idea-${Date.now()}-${index}.jpg`,
      }));
    }

    console.log('Sending to Airtable:', {
      fieldsCount: Object.keys(fields).length,
      hasImage: !!fields[AIRTABLE_FIELDS.IMAGE],
      title: fields[AIRTABLE_FIELDS.TITLE]
    });

    // Send to Airtable
    const result = await airtableFetch('', {
      method: 'POST',
      params: { typecast: true },
      body: JSON.stringify({
        records: [{ fields }],
      }),
    });

    console.log('Airtable success:', result);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/ideas error:', error);

    // Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      const zodErr = error as any;
      return NextResponse.json(
        {
          error: 'Ugyldig data sendt inn',
          issues: zodErr.issues?.map((i: any) => ({
            path: i.path?.join('.') ?? '',
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // Airtable errors
    if (error instanceof AirtableError) {
      console.error('Airtable error:', error.status, error.message);
      
      const statusMap: Record<number, number> = {
        401: 500,
        403: 500,
        422: 400,
        429: 503,
      };

      return NextResponse.json(
        { error: `Kunne ikke lagre idé: ${error.message}` },
        { status: statusMap[error.status] || 500 }
      );
    }

    return NextResponse.json(
      { error: 'En feil oppstod ved lagring av idé' },
      { status: 500 }
    );
  }
}

// PATCH /api/ideas
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Record ID mangler' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );

    const normStage = normalizeStage((cleanedBody as any).stage);
    if (normStage) (cleanedBody as any).stage = normStage;
    else delete (cleanedBody as any).stage;
    
    const validatedData = ideaSchema.partial().parse(cleanedBody);

    const fields: Record<string, any> = {};
    
    if (validatedData.title) fields[AIRTABLE_FIELDS.TITLE] = validatedData.title;
    if (validatedData.description !== undefined) fields[AIRTABLE_FIELDS.DESCRIPTION] = validatedData.description;
    if (validatedData.type) fields[AIRTABLE_FIELDS.TYPE] = validatedData.type;
    if (validatedData.stage !== undefined) fields[AIRTABLE_FIELDS.STAGE] = validatedData.stage;
    if (validatedData.targetAudience !== undefined) fields[AIRTABLE_FIELDS.TARGET_AUDIENCE] = validatedData.targetAudience;
    if (validatedData.needsProblem !== undefined) fields[AIRTABLE_FIELDS.NEEDS_PROBLEM] = validatedData.needsProblem;
    if (validatedData.valueProposition !== undefined) fields[AIRTABLE_FIELDS.VALUE_PROPOSITION] = validatedData.valueProposition;
    
    // Ratings
    if (validatedData.strategicFit !== undefined) {
      fields[AIRTABLE_FIELDS.STRATEGIC_FIT] = validatedData.strategicFit;
    }
    if (validatedData.consumerNeed !== undefined) {
      fields[AIRTABLE_FIELDS.CONSUMER_NEED] = validatedData.consumerNeed;
    }
    if (validatedData.businessPotential !== undefined) {
      fields[AIRTABLE_FIELDS.BUSINESS_POTENTIAL] = validatedData.businessPotential;
    }
    if (validatedData.feasibility !== undefined) {
      fields[AIRTABLE_FIELDS.FEASIBILITY] = validatedData.feasibility;
    }
    if (validatedData.launchTime !== undefined) {
      fields[AIRTABLE_FIELDS.LAUNCH_TIME] = validatedData.launchTime;
    }
    
    if (validatedData.imageUrls && validatedData.imageUrls.length > 0) {
      fields[AIRTABLE_FIELDS.IMAGE] = validatedData.imageUrls.map((url, index) => ({
        url,
        filename: `idea-${Date.now()}-${index}.jpg`,
      }));
    }

    const result = await airtableFetch(`/${recordId}`, {
      method: 'PATCH',
      params: { typecast: true },
      body: JSON.stringify({ fields }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('PATCH /api/ideas error:', error);
    
    return NextResponse.json(
      { error: 'Kunne ikke oppdatere idé' },
      { status: 500 }
    );
  }
}

// DELETE /api/ideas
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    const archive = url.searchParams.get('archive') === 'true';
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Record ID mangler' },
        { status: 400 }
      );
    }

    if (archive) {
      const result = await airtableFetch(`/${recordId}`, {
        method: 'PATCH',
        params: { typecast: true },
        body: JSON.stringify({ 
          fields: { 
            [AIRTABLE_FIELDS.STAGE]: 'Arkivert' 
          } 
        }),
      });

      return NextResponse.json(result);
    } else {
      await airtableFetch(`/${recordId}`, {
        method: 'DELETE',
      });

      return NextResponse.json({ success: true, deleted: true });
    }
  } catch (error) {
    console.error('DELETE /api/ideas error:', error);
    
    return NextResponse.json(
      { error: 'Kunne ikke slette idé' },
      { status: 500 }
    );
  }
}