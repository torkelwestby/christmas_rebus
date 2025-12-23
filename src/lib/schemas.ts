import { z } from 'zod';

export const ideaSchema = z.object({
  title: z.string().min(2, 'Tittel må være minst 2 tegn'),
  description: z.string().optional(),
  type: z.enum(
    ['Inspirasjon', 'Ide klar for vurdering til innovasjonsporteføljen'],
    { message: 'Ugyldig type' }
  ).optional(),  // OPTIONAL!
  stage: z.enum([
    'Idégenerering',
    'Idéutforsking',
    'Problem/Løsning',
    'Produkt/Marked',
    'Skalering',
    'Arkivert',
  ]).optional(),

  submitter: z.string().optional(),

  // Opprinnelig enkel URL (behold for bakoverkomp.)
  imageUrl: z.string().url().optional(),

  // Nye felter brukt i form/API
  targetAudience: z.string().optional(),
  needsProblem: z.string().optional(),
  valueProposition: z.string().optional(),
  nextSteps: z.string().optional(),
  category: z.array(z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  
  // Vurderingsfelter (ratings 1-5)
  strategicFit: z.number().min(1).max(5).optional(),
  consumerNeed: z.number().min(1).max(5).optional(),
  businessPotential: z.number().min(1).max(5).optional(),
  feasibility: z.number().min(1).max(5).optional(),
  launchTime: z.number().min(1).max(5).optional(),
});

export type IdeaInput = z.infer<typeof ideaSchema>;

export const AIRTABLE_FIELDS = {
  TITLE: 'fldKXo4ub5pqqTjG9',
  DESCRIPTION: 'fld0mPPNrE5pRxENI',
  TYPE: 'fldhBleuXFNt9bWLP',
  STAGE: 'fldTOdb9VgP0MdtNN',
  IMAGE: 'fldz4NQq8uolOnbRY',
  SUBMITTER: 'fldfG5fBJ8E9iNVa1',
  DATE_SUBMITTED: 'fld9Hi3Emxlhoi9GE',

  // Nye felt-IDer brukt i liste/API
  TARGET_AUDIENCE: 'fldPchK9TQYU6Ohtb',
  NEEDS_PROBLEM: 'fldzjuFp9VpT7OYEG',
  VALUE_PROPOSITION: 'fldxJ85CvJoyjdZEL',
  
  // Vurderingsfelter
  STRATEGIC_FIT: 'fldkbyMg9d5ujd0h3',
  CONSUMER_NEED: 'fldNNHrSoKmEc1mh2',
  BUSINESS_POTENTIAL: 'fldLQPswmcUbOLqdm',
  FEASIBILITY: 'fldiapbgGw4wyY2B6',
  LAUNCH_TIME: 'fldGfvOxKOKvRt4XO',
  AVERAGE_SCORE: 'fldI1o5fXeWLTP5e0',

  // Fyll inn korrekte ID-er før aktivering
  NEXT_STEPS: 'fld_NEXT_STEPS_TODO',
  CATEGORY: 'fld_CATEGORY_TODO',
} as const;