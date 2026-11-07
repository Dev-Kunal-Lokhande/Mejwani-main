const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const outputPath = path.join(__dirname, '../src/constants/env.ts');

let apiUrl = 'http://localhost:5000/api';
let socketUrl = 'http://localhost:5000';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key === 'API_URL') {
          apiUrl = value;
        } else if (key === 'SOCKET_URL') {
          socketUrl = value;
        }
      }
    }
  }
}

const outputContent = `// Generated automatically from .env. Do not edit directly.
export const API_URL = '${apiUrl}';
export const SOCKET_URL = '${socketUrl}';
`;

fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log('Successfully generated src/constants/env.ts');
