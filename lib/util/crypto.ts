import crypto from 'crypto';


export function sha256 (string: string): string {
  return crypto.createHash('sha256').update(string).digest('hex');
}

