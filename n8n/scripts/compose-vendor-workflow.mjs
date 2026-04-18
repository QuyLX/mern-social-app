import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsCode = execSync(`node ${path.join(__dirname, 'build-github-code-embed.mjs')}`, {
  encoding: 'utf8',
});

const workflow = {
  name: 'Vendor MERN — GitHub → Telegram (Topics)',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'vendor-github',
        options: {},
      },
      id: 'wh-github-1',
      name: 'Webhook GitHub',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: 'vendor-github-ingest',
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode,
      },
      id: 'code-github-1',
      name: 'Route GitHub to Telegram',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, 0],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'c1',
              leftValue: '={{ $json.requestUrl }}',
              rightValue: '',
              operator: { operation: 'notEmpty', type: 'string' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'if-has-url-1',
      name: 'IF Has Telegram URL',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [520, 0],
    },
    {
      parameters: {
        method: 'POST',
        url: '={{ $json.requestUrl }}',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
          '={{ { chat_id: $json.chat_id, message_thread_id: $json.message_thread_id, text: $json.text, parse_mode: $json.parse_mode, reply_markup: $json.reply_markup } }}',
        options: {},
      },
      id: 'http-tg-1',
      name: 'Telegram sendMessage',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [780, -40],
    },
    {
      parameters: {},
      id: 'noop-1',
      name: 'No Telegram send',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [780, 120],
    },
  ],
  connections: {
    'Webhook GitHub': { main: [[{ node: 'Route GitHub to Telegram', type: 'main', index: 0 }]] },
    'Route GitHub to Telegram': { main: [[{ node: 'IF Has Telegram URL', type: 'main', index: 0 }]] },
    'IF Has Telegram URL': {
      main: [
        [{ node: 'Telegram sendMessage', type: 'main', index: 0 }],
        [{ node: 'No Telegram send', type: 'main', index: 0 }],
      ],
    },
  },
  pinData: {},
  settings: { executionOrder: 'v1' },
  staticData: null,
  tags: [],
  triggerCount: 0,
  updatedAt: new Date().toISOString(),
  versionId: 'vendor-hub-v1',
};

const out = path.join(__dirname, '..', 'workflows', 'vendor-notification-hub.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Wrote', out);
