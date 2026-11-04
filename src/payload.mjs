export class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sensitive = /authorization|cookie|password|passwd|secret|token|api[-_]?key|signature/i;
export const MASK = '[REDACTED]';

export function redact(value, depth = 0) {
  if (depth > 40) throw new RequestError(400, 'JSON ซ้อนกันลึกเกิน 40 ชั้น');
  if (Array.isArray(value)) return value.map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, sensitive.test(key) ? MASK : redact(item, depth + 1)]));
  }
  return value;
}

export function paramsObject(params) {
  const result = new Map();
  for (const [key, value] of params) result.set(key, [...(result.get(key) ?? []), value]);
  return Object.fromEntries([...result].map(([key, values]) => [key, values.length === 1 ? values[0] : values]));
}

export function readBody(request, limit = 262144) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let oversized = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        if (!oversized) { oversized = true; reject(new RequestError(413, 'รับ body ได้สูงสุด 256 KiB')); }
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!oversized) resolve(Buffer.concat(chunks)); });
    request.on('error', reject);
    request.on('aborted', () => reject(new RequestError(400, 'การส่งข้อมูลถูกยกเลิก')));
  });
}

export function parseBody(buffer, contentType = '') {
  if (buffer.length === 0) return { kind: 'empty', value: null };
  const type = contentType.split(';')[0].trim().toLowerCase();
  const text = buffer.toString('utf8');
  if (type === 'application/json' || type.endsWith('+json')) {
    let value;
    try { value = JSON.parse(text); }
    catch { throw new RequestError(400, 'JSON ไม่ถูกต้อง จึงยังไม่ได้บันทึก'); }
    return { kind: 'json', value: redact(value) };
  }
  if (type === 'application/x-www-form-urlencoded') {
    return { kind: 'form', value: redact(paramsObject(new URLSearchParams(text))) };
  }
  // Structured input lets us mask known secret fields before anything reaches disk.
  throw new RequestError(415, 'รอบนี้รองรับ body แบบ JSON และ form-urlencoded');
}
