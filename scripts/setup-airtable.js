/**
 * Script for å sette opp Airtable-kolonner for julerebus-appen
 *
 * Dette scriptet oppretter alle nødvendige kolonner i din Airtable-base
 * for å lagre fremgang og planlagte datoer for hver rebus.
 *
 * Kjør: node scripts/setup-airtable.js
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

// Kolonner som skal opprettes
const FIELDS_TO_CREATE = [
  // Rebus 1
  { name: 'rebus1_solved', type: 'checkbox', description: 'Om rebus 1 er løst', options: { icon: 'check', color: 'greenBright' } },
  { name: 'rebus1_date', type: 'date', description: 'Planlagt dato for rebus 1', options: { dateFormat: { name: 'local', format: 'l' } } },
  { name: 'rebus1_time', type: 'singleLineText', description: 'Planlagt tidspunkt for rebus 1' },

  // Rebus 2
  { name: 'rebus2_solved', type: 'checkbox', description: 'Om rebus 2 er løst', options: { icon: 'check', color: 'greenBright' } },
  { name: 'rebus2_date', type: 'date', description: 'Planlagt dato for rebus 2', options: { dateFormat: { name: 'local', format: 'l' } } },
  { name: 'rebus2_time', type: 'singleLineText', description: 'Planlagt tidspunkt for rebus 2' },

  // Rebus 3
  { name: 'rebus3_solved', type: 'checkbox', description: 'Om rebus 3 er løst', options: { icon: 'check', color: 'greenBright' } },
  { name: 'rebus3_date', type: 'date', description: 'Planlagt dato for rebus 3', options: { dateFormat: { name: 'local', format: 'l' } } },
  { name: 'rebus3_time', type: 'singleLineText', description: 'Planlagt tidspunkt for rebus 3' },

  // Rebus 4
  { name: 'rebus4_solved', type: 'checkbox', description: 'Om rebus 4 er løst', options: { icon: 'check', color: 'greenBright' } },
  { name: 'rebus4_date', type: 'date', description: 'Planlagt dato for rebus 4', options: { dateFormat: { name: 'local', format: 'l' } } },
  { name: 'rebus4_time', type: 'singleLineText', description: 'Planlagt tidspunkt for rebus 4' },

  // Rebus 5
  { name: 'rebus5_solved', type: 'checkbox', description: 'Om rebus 5 er løst', options: { icon: 'check', color: 'greenBright' } },
  { name: 'rebus5_date', type: 'date', description: 'Planlagt dato for rebus 5', options: { dateFormat: { name: 'local', format: 'l' } } },
  { name: 'rebus5_time', type: 'singleLineText', description: 'Planlagt tidspunkt for rebus 5' },
];

async function getExistingFields() {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch table schema: ${response.statusText}`);
  }

  const data = await response.json();
  const table = data.tables.find(t => t.id === AIRTABLE_TABLE_ID);

  if (!table) {
    throw new Error(`Table ${AIRTABLE_TABLE_ID} not found`);
  }

  return table.fields;
}

async function createField(fieldConfig) {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${AIRTABLE_TABLE_ID}/fields`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fieldConfig),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create field ${fieldConfig.name}: ${error}`);
  }

  return response.json();
}

async function setupAirtable() {
  console.log('🎄 Starter Airtable-oppsett for julerebus...\n');

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
    console.error('❌ Mangler Airtable-konfigurasjon i .env.local');
    console.error('Sjekk at følgende er satt:');
    console.error('- AIRTABLE_TOKEN');
    console.error('- AIRTABLE_BASE_ID');
    console.error('- AIRTABLE_TABLE_ID');
    process.exit(1);
  }

  console.log(`Base ID: ${AIRTABLE_BASE_ID}`);
  console.log(`Table ID: ${AIRTABLE_TABLE_ID}\n`);

  try {
    // Hent eksisterende felter
    console.log('📋 Henter eksisterende felter...');
    const existingFields = await getExistingFields();
    const existingFieldNames = existingFields.map(f => f.name);

    console.log(`Funnet ${existingFields.length} eksisterende felter\n`);

    // Opprett manglende felter
    console.log('➕ Oppretter manglende felter...\n');

    let created = 0;
    let skipped = 0;

    for (const field of FIELDS_TO_CREATE) {
      if (existingFieldNames.includes(field.name)) {
        console.log(`⏭️  ${field.name} - eksisterer allerede`);
        skipped++;
        continue;
      }

      try {
        await createField(field);
        console.log(`✅ ${field.name} - opprettet`);
        created++;

        // Vent litt mellom hver request for å unngå rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch (error) {
        console.error(`❌ ${field.name} - feilet: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n🎉 Ferdig!`);
    console.log(`   Opprettet: ${created} felter`);
    console.log(`   Hoppet over: ${skipped} felter (eksisterte allerede)`);
    console.log('\n✨ Airtable-basen er nå klar for julerebus-appen!\n');

  } catch (error) {
    console.error('\n❌ Feil ved oppsett:', error.message);
    process.exit(1);
  }
}

// Kjør setup
setupAirtable();
