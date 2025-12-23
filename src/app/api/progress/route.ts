import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

interface RebusProgress {
  rebus1_solved?: boolean;
  rebus1_date?: string;
  rebus1_time?: string;
  rebus2_solved?: boolean;
  rebus2_date?: string;
  rebus2_time?: string;
  rebus3_solved?: boolean;
  rebus3_date?: string;
  rebus3_time?: string;
  rebus4_solved?: boolean;
  rebus4_date?: string;
  rebus4_time?: string;
  rebus5_solved?: boolean;
  rebus5_date?: string;
  rebus5_time?: string;
}

// GET - Hent fremgang fra Airtable
export async function GET() {
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
      return NextResponse.json({ rebuses: [] });
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Airtable error:', await response.text());
      return NextResponse.json({ rebuses: [] });
    }

    const data = await response.json();

    // Hent første record (vi bruker en enkelt rad for å lagre all fremgang)
    const record = data.records?.[0];

    if (!record) {
      return NextResponse.json({ rebuses: [] });
    }

    const fields = record.fields as RebusProgress;

    // Konverter Airtable data til rebus state
    const rebuses = [1, 2, 3, 4, 5].map(id => ({
      id,
      solved: fields[`rebus${id}_solved` as keyof RebusProgress] || false,
      userAnswer: '',
      feedback: '',
      isChecking: false,
      scheduledDate: fields[`rebus${id}_date` as keyof RebusProgress] || '',
      scheduledTime: fields[`rebus${id}_time` as keyof RebusProgress] || '',
    }));

    return NextResponse.json({ rebuses });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ rebuses: [] });
  }
}

// POST - Lagre fremgang til Airtable
export async function POST(request: NextRequest) {
  try {
    const { rebusId, solved, scheduledDate, scheduledTime } = await request.json();

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
      return NextResponse.json(
        { error: 'Airtable not configured' },
        { status: 500 }
      );
    }

    // Først, hent eller opprett record
    const getUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    const getResponse = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const getData = await getResponse.json();
    let recordId = getData.records?.[0]?.id;

    // Bygg fields object
    const fields: any = {
      [`rebus${rebusId}_solved`]: solved,
    };

    if (scheduledDate) {
      fields[`rebus${rebusId}_date`] = scheduledDate;
    }
    if (scheduledTime) {
      fields[`rebus${rebusId}_time`] = scheduledTime;
    }

    // Oppdater eller opprett record
    if (recordId) {
      // Oppdater eksisterende
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;

      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Airtable update error:', errorText);
        return NextResponse.json(
          { error: 'Failed to update progress' },
          { status: 500 }
        );
      }
    } else {
      // Opprett ny record
      const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Airtable create error:', errorText);
        return NextResponse.json(
          { error: 'Failed to save progress' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving progress:', error);
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    );
  }
}
