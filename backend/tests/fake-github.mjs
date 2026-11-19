// A pretend GitHub for the off-site backup tests: just the few API calls src/utils/offsiteBackup.ts makes,
// on a local port, so nothing real is ever contacted. Point the portal at it with BACKUP_API_URL.
import http from 'node:http';
import crypto from 'node:crypto';

const sha = (x) => crypto.createHash('sha1').update(x).digest('hex');

export async function startFakeGitHub({ token = 'ghp_faketoken1234567890', repo = 'owner/school-backups', isPrivate = true, defaultBranch = 'main', empty = false } = {}) {
  const state = {
    requests: [],               // 'METHOD /path', in order
    branches: new Map(),        // name -> head sha
    files: new Map(),           // `${branch}:${path}` -> { content: Buffer, sha }
    commits: 0,                 // how many times a file was written
    failWith: 0,                // when set, every request gets this status (an outage)
  };
  if (!empty) state.branches.set(defaultBranch, sha('first commit'));

  const body = (req) => new Promise((resolve) => { const parts = []; req.on('data', (c) => parts.push(c)); req.on('end', () => resolve(Buffer.concat(parts))); });
  const send = (res, status, json) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(json)); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake');
    const route = decodeURIComponent(url.pathname);
    state.requests.push(`${req.method} ${route}`);
    const raw = await body(req);
    if (state.failWith) return send(res, state.failWith, { message: 'Simulated outage' });
    if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { message: 'Bad credentials' });

    const base = `/repos/${repo}`;
    if (!route.startsWith(base)) return send(res, 404, { message: 'Not Found' });
    const rest = route.slice(base.length);

    if (req.method === 'GET' && rest === '') return send(res, 200, { full_name: repo, private: isPrivate, default_branch: defaultBranch });

    let m;
    if (req.method === 'GET' && (m = rest.match(/^\/branches\/(.+)$/))) return state.branches.has(m[1]) ? send(res, 200, { name: m[1] }) : send(res, 404, { message: 'Branch not found' });
    if (req.method === 'GET' && (m = rest.match(/^\/git\/ref\/heads\/(.+)$/))) return state.branches.has(m[1]) ? send(res, 200, { object: { sha: state.branches.get(m[1]) } }) : send(res, 404, { message: 'Not Found' });
    if (req.method === 'POST' && rest === '/git/refs') {
      const { ref, sha: from } = JSON.parse(raw.toString() || '{}');
      const name = String(ref).replace(/^refs\/heads\//, '');
      if (state.branches.has(name)) return send(res, 422, { message: 'Reference already exists' });
      if (![...state.branches.values()].includes(from)) return send(res, 422, { message: 'Object does not exist' });
      state.branches.set(name, from);
      return send(res, 201, { ref });
    }

    if ((m = rest.match(/^\/contents\/(.+)$/))) {
      const file = m[1];
      const branch = url.searchParams.get('ref') || defaultBranch;
      if (req.method === 'GET') {
        const f = state.files.get(`${branch}:${file}`);
        if (!state.branches.has(branch) || !f) return send(res, 404, { message: 'Not Found' });
        if ((req.headers.accept || '').includes('raw')) { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end(f.content); }
        return send(res, 200, { sha: f.sha, encoding: 'base64', content: f.content.length > 1048576 ? '' : f.content.toString('base64') });
      }
      if (req.method === 'PUT') {
        const j = JSON.parse(raw.toString() || '{}');
        if (!state.branches.has(j.branch)) return send(res, 404, { message: 'Branch not found' });
        const have = state.files.get(`${j.branch}:${file}`);
        if (have && !j.sha) return send(res, 422, { message: "Invalid request. \"sha\" wasn't supplied." });
        if (have && j.sha !== have.sha) return send(res, 409, { message: `${file} does not match ${j.sha}` });
        const content = Buffer.from(j.content, 'base64');
        const entry = { content, sha: sha(content) };
        state.files.set(`${j.branch}:${file}`, entry);
        state.commits++;
        return send(res, have ? 200 : 201, { content: { sha: entry.sha } });
      }
    }
    return send(res, 404, { message: 'Not Found' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, state, token, repo,
    /** The bytes of the file as stored on a branch, or null. */
    stored: (branch = 'data-backup', file = 'snapshot.bin') => state.files.get(`${branch}:${file}`)?.content ?? null,
    /** The three settings (and the address) a portal needs to use this pretend GitHub. */
    env: (extra = {}) => ({ BACKUP_GITHUB_TOKEN: token, BACKUP_GITHUB_REPO: repo, BACKUP_PASSPHRASE: 'a long test passphrase for the school portal', BACKUP_API_URL: url, ...extra }),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
  };
}
