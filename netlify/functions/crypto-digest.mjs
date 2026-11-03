import crypto from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const {algorithm = 'SHA-256', data = '', encoding = 'hex'} = payload;
    const normalizedAlgo = String(algorithm)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const algoMap = {
      MD5: 'md5',
      SHA1: 'sha1',
      SHA256: 'sha256',
      SHA384: 'sha384',
      SHA512: 'sha512',
    };
    const nodeAlgo = algoMap[normalizedAlgo] || 'sha256';
    const digest = crypto
      .createHash(nodeAlgo)
      .update(String(data), 'utf8')
      .digest(encoding === 'base64' ? 'base64' : 'hex');

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({digest}),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({error: err?.message || 'Crypto digest failed'}),
    };
  }
}
