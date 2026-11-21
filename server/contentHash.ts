import crypto from 'crypto';

/**
 * Computes a normalized SHA-256 hash of the question content:
 * Normalized question text + normalized type + normalized options.
 * This guarantees idempotent ingests — duplicate questions will produce
 * the exact same hash and will never be duplicated in the database.
 */
export function computeContentHash(
  questionText: string,
  type: string,
  options?: string[] | null
): string {
  // Normalize whitespace and case in question text
  const normText = questionText.trim().toLowerCase().replace(/\s+/g, ' ');
  const normType = type.trim().toUpperCase();

  // Normalize options: trim, lowercase, sort alphabetically so option order doesn't affect hash
  const normOptions = (options || [])
    .map((o) => o.trim().toLowerCase().replace(/\s+/g, ' '))
    .sort()
    .join('|||');

  const payload = `${normText}:::${normType}:::${normOptions}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
