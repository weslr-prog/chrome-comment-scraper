import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import { spawn } from 'node:child_process';

const root = process.cwd();
const uiPath = path.join(root, 'ui', 'index.html');
const outputDir = path.join(root, 'output');
const port = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return serveIndex(res);
  }

  if (req.method === 'POST' && req.url === '/run') {
    return handleRun(req, res);
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`UI ready at http://localhost:${port}`);
});

function serveIndex(res) {
  if (!fs.existsSync(uiPath)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing ui/index.html' }));
    return;
  }

  const html = fs.readFileSync(uiPath, 'utf8');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

async function handleRun(req, res) {
  try {
    const body = await readJson(req);
    const url = String(body.url || '').trim();

    if (!/^https:\/\/chromewebstore\.google\.com\/detail\//i.test(url)) {
      throw new Error('Please provide a valid Chrome Web Store detail URL.');
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const reviewsPath = path.join(outputDir, 'reviews.json');
    const summaryPath = path.join(outputDir, 'summary.json');

    await runNodeScript([
      'scripts/analyze-reviews.mjs',
      '--url',
      url,
      '--reviews',
      reviewsPath,
      '--summary',
      summaryPath
    ]);

    const reviewsPayload = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      summary,
      reviews: reviewsPayload.reviews || []
    }));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'Run failed' }));
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
      if (chunks.reduce((sum, item) => sum + item.length, 0) > 1_000_000) {
        reject(new Error('Request body too large.'));
      }
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function runNodeScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'pipe',
      shell: false,
      env: process.env
    });

    let stderr = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Script failed with code ${code}`));
      }
    });
  });
}
