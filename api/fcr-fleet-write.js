// Writes the FCR Fleet data.json on GitHub using a server-side token, so the
// token no longer has to live in the public fcr-fleet page. Set the env var
// GH_FLEET_TOKEN in Vercel (fine-grained PAT scoped to repo kobe-cnk/fcr-fleet,
// Contents: read & write). Called cross-origin from the Fleet app.
// POST { data: [ ...units... ] } -> commits data.json, returns { ok, sha }

const GH = process.env.GH_FLEET_TOKEN;
const REPO = 'kobe-cnk/fcr-fleet';
const PATH = 'data.json';
const BRANCH = 'main';
const API = 'https://api.github.com/repos/' + REPO + '/contents/' + PATH;

function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function b64(str){ return Buffer.from(str, 'utf8').toString('base64'); }

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!GH) { res.status(200).json({ ok: false, error: 'Fleet write not configured' }); return; }
  try {
    const data = (req.body && req.body.data);
    if (!Array.isArray(data)) { res.status(200).json({ ok: false, error: 'Missing data array' }); return; }
    const headers = { 'Authorization': 'token ' + GH, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'fcr-fleet-proxy' };
    // current sha
    let sha = null;
    const g = await fetch(API + '?ref=' + BRANCH, { headers });
    if (g.ok) { const gj = await g.json(); sha = gj.sha || null; }
    const body = { message: 'Fleet update (proxy)', content: b64(JSON.stringify(data)), branch: BRANCH };
    if (sha) body.sha = sha;
    const p = await fetch(API, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
    const out = await p.json();
    if (!p.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + p.status) }); return; }
    res.status(200).json({ ok: true, sha: out.content && out.content.sha });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
