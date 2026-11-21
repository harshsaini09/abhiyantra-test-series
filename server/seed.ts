import { ingestQuestions } from './ingest';
import { sampleTestData } from '../src/utils/sampleData';

async function seed() {
  console.log('Seeding initial questions into Question Bank...');
  const result = await ingestQuestions({
    title: sampleTestData.title,
    subject: sampleTestData.subject,
    topic: sampleTestData.topic,
    questions: sampleTestData.questions as any,
  });
  console.log(`Seed complete: ${result.newInserted} questions inserted, ${result.duplicatesSkipped} duplicates skipped.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
