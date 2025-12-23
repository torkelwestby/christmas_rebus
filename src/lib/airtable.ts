// Airtable API wrapper med autentisering og feilhåndtering

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

interface AirtableConfig {
  token: string;
  baseId: string;
  tableId: string;
}

const getConfig = (): AirtableConfig => {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;

  if (!token || !baseId || !tableId) {
    throw new Error('Missing Airtable configuration');
  }

  return { token, baseId, tableId };
};

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export async function airtableFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const config = getConfig();
  const { params, ...fetchOptions } = options;

  // Bygg URL med query params
  let url = `${AIRTABLE_API_URL}/${config.baseId}/${config.tableId}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    cache: 'no-store', // Aldri cache Airtable-data
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Airtable API Error Details:', JSON.stringify(error, null, 2));
    
    const errorMessage = typeof error.error === 'string' 
      ? error.error 
      : error.error?.message || JSON.stringify(error.error) || 'Airtable API error';
    
    throw new AirtableError(response.status, errorMessage);
  }

  return response.json();
}

export class AirtableError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AirtableError';
  }
}