import type { ParseEmailsResult } from '../types';

const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const emailHeaders = new Set(['email', 'emails', 'e-mail', 'mail', 'email address', 'email_address', 'emailaddress']);

export function isValidEmail(email: string) {
  const local = email.split('@', 1)[0];
  return email.length <= 254 && local.length <= 64 &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    emailPattern.test(email);
}

function readRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  function finishField() {
    row.push(field.trim());
    field = '';
  }

  function finishRow() {
    finishField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted) {
      if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
    } else if (character === '"' && !field.trim()) {
      quoted = true;
    } else if (!quoted && character === '\n') {
      finishRow();
    } else if (!quoted && (character === ',' || character === ';' || character === '\t')) {
      finishField();
    } else {
      field += character;
    }
  }
  finishRow();
  return rows;
}

export function parseEmailList(rawText: string): ParseEmailsResult {
  const rows = readRows(rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
  const column = rows[0]?.findIndex((field) => emailHeaders.has(field.toLowerCase())) ?? -1;
  const fields = column < 0 ? rows.flat() : rows.slice(1).map((row) => row[column] ?? '');
  const emails = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const field of fields) {
    for (const token of field.split(/\s+/)) {
      const email = token.replace(/^<|>$/g, '').toLowerCase();
      if (!email) continue;
      if (!isValidEmail(email)) invalidCount += 1;
      else if (emails.has(email)) duplicateCount += 1;
      else emails.add(email);
    }
  }

  return { validEmails: [...emails], invalidCount, duplicateCount, totalParsed: emails.size + invalidCount + duplicateCount };
}
