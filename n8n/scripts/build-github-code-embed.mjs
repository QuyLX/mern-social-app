import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = fs.readFileSync(path.join(__dirname, 'code-nodes.js'), 'utf8');
const core = base.split('/* ---------- Example')[0].trim();

const tail = `
const root = $input.first().json;
const headers = root.headers || {};
const event = String(headers['x-github-event'] || headers['X-GitHub-Event'] || '').toLowerCase();
const body = root.body || root;
let mapping = {};
try {
  mapping = JSON.parse($vars.mappingJson || '{}');
} catch (e) {
  return [{ json: { skip: true, reason: 'BAD_MAPPING_JSON', detail: String(e.message) } }];
}
let routes = [];
if (event === 'pull_request') {
  routes = routes.concat(routeGithubPullRequest(body, mapping));
  routes = routes.concat(routeGithubPullRequestMerged(body, mapping));
}
if (event === 'workflow_run') {
  routes = routes.concat(routeGithubWorkflowRun(body, mapping));
}
const token = $vars.telegramBotToken || '';
const out = [];
for (const row of routes) {
  const payload = buildTelegramSendPayload(row, mapping);
  if (payload.skip) continue;
  out.push({
    json: {
      ...payload,
      requestUrl: 'https://api.telegram.org/bot' + token + '/sendMessage',
    },
  });
}
return out.length ? out : [{ json: { _noop: true, reason: 'NO_ROUTE', event } }];
`.trim();

const full = `${core}\n\n${tail}`;
// Raw source for n8n (compose workflow will JSON.stringify once)
process.stdout.write(full);
