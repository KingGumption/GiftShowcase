const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { request } = require('https');

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT;
const bucket = process.env.R2_BUCKET;
const sourceDir = process.argv[2];
const concurrency = Number(process.env.R2_UPLOAD_CONCURRENCY || 6);

if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !sourceDir) {
  console.error('Missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, or source directory.');
  process.exit(1);
}

const endpointUrl = new URL(endpoint);
const root = path.resolve(sourceDir);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : fullPath;
  });
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function objectKeyFor(filePath) {
  return path.relative(root, filePath).split(path.sep).map(rfc3986).join('/');
}

async function uploadFile(filePath) {
  const key = objectKeyFor(filePath);
  const payloadHash = await hashFile(filePath);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const host = endpointUrl.host;
  const canonicalUri = `/${bucket}/${key}`;
  const contentType = contentTypeFor(filePath);
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const stat = fs.statSync(filePath);

  return new Promise((resolve, reject) => {
    const req = request({
      method: 'PUT',
      protocol: endpointUrl.protocol,
      hostname: endpointUrl.hostname,
      path: canonicalUri,
      headers: {
        Authorization: authorization,
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
      },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`${res.statusCode} ${res.statusMessage}: ${body.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    fs.createReadStream(filePath).on('error', reject).pipe(req);
  });
}

async function main() {
  const files = walk(root);
  let completed = 0;
  let failed = 0;
  let cursor = 0;

  console.log(`Uploading ${files.length} files from ${root} to ${bucket}`);

  async function worker() {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      try {
        await uploadFile(file);
        completed++;
        if (completed % 50 === 0 || completed === files.length) {
          console.log(`Uploaded ${completed}/${files.length}`);
        }
      } catch (error) {
        failed++;
        console.error(`Failed ${path.relative(root, file)}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  if (failed) {
    console.error(`Done with ${failed} failed upload(s).`);
    process.exit(1);
  }

  console.log('Upload complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
