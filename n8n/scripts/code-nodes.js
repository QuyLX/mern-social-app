/**
 * n8n Code node helpers — self-hosted n8n (no import/require).
 * Cách dùng: copy toàn bộ file vào một Code node, hoặc copy các hàm cần dùng
 * và gán `return` cuối node theo ví dụ ở cuối file.
 *
 * Mapping: dán JSON từ mapping.json vào n8n Variables (hoặc đọc từ static data).
 * Ví dụ biến workflow: $vars.mappingJson (string) — tuỳ phiên bản n8n đổi tên.
 */

'use strict';

/** @typedef {{ handle: string, displayName?: string }} TgUser */

const TASK_ID_REGEX = /\[([A-Z][A-Z0-9]*-\d+)\]/;
const BRANCH_TASK_REGEX = /^[a-z][a-z0-9_-]+\/([A-Z][A-Z0-9]*-\d+)(?:-[a-z0-9._-]+)*$/;

/**
 * Escape Telegram MarkdownV2 reserved characters.
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdownV2(text) {
  if (text == null || text === '') return '';
  return String(text).replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

/**
 * Extract first [TASK-ID] from PR title.
 * @param {string} title
 * @returns {{ taskId: string } | { error: string }}
 */
function extractTaskIdFromTitle(title) {
  const m = (title || '').match(TASK_ID_REGEX);
  if (!m) return { error: 'MISSING_TASK_ID_IN_TITLE' };
  return { taskId: m[1] };
}

/**
 * Extract TASK-ID from branch type/TASK-ID-slug
 * @param {string} branch
 */
function extractTaskIdFromBranch(branch) {
  const m = (branch || '').match(BRANCH_TASK_REGEX);
  if (!m) return { error: 'INVALID_BRANCH_PATTERN' };
  return { taskId: m[1] };
}

/**
 * @param {Record<string, TgUser>} map
 * @param {string} githubLogin lower-case login
 * @returns {{ handle: string, displayName?: string } | null}
 */
function mapGithubToTelegram(map, githubLogin) {
  if (!map || !githubLogin) return null;
  const row = map[githubLogin] || map[githubLogin.toLowerCase()];
  if (!row || !row.handle) return null;
  return { handle: row.handle, displayName: row.displayName };
}

/**
 * Plain @handle trong MarkdownV2 (escape ký tự đặc biệt trong phần còn lại của tin).
 */
function formatPlainAt(user) {
  if (!user || !user.handle) return '';
  const h = user.handle.startsWith('@') ? user.handle : `@${user.handle}`;
  return escapeMarkdownV2(h);
}

/**
 * GitHub pull_request payload → routes for Telegram topics
 * @param {object} payload body from GitHub webhook
 * @param {string} action pull_request action
 * @param {object} mapping parsed mapping.json
 */
function routeGithubPullRequest(payload, mapping) {
  const action = payload.action;
  const pr = payload.pull_request || {};
  const title = pr.title || '';
  const draft = !!pr.draft;
  const htmlUrl = pr.html_url || '';
  const head = pr.head || {};
  const branch = head.ref || '';
  const authorLogin = (pr.user && pr.user.login) || '';
  const reviewers = pr.requested_reviewers || [];

  const taskTitle = extractTaskIdFromTitle(title);
  const taskBranch = extractTaskIdFromBranch(branch);
  const taskId =
    'taskId' in taskTitle ? taskTitle.taskId : 'taskId' in taskBranch ? taskBranch.taskId : null;

  const authorTg = mapGithubToTelegram(mapping.githubUserToTelegram || {}, authorLogin);
  const reviewerMentions = reviewers
    .map((r) => mapGithubToTelegram(mapping.githubUserToTelegram || {}, r.login))
    .filter(Boolean);

  const fireReview =
    action === 'ready_for_review' ||
    action === 'review_requested' ||
    (action === 'opened' && !draft && reviewers.length > 0);

  if (!fireReview) return [];

  return [
    {
      topicKey: 'review',
      kind: 'github_pr_review',
      taskId,
      title,
      htmlUrl,
      branch,
      authorLogin,
      authorTg,
      reviewerMentions,
    },
  ];
}

/**
 * workflow_run (GitHub Actions) → CI fail on develop/main
 */
function routeGithubWorkflowRun(payload, mapping) {
  if ((payload.action || '') !== 'completed') return [];
  const wr = payload.workflow_run || {};
  const name = wr.name || '';
  const conclusion = wr.conclusion || '';
  const branch = wr.head_branch || '';
  const htmlUrl = wr.html_url || '';
  const protectedBranches = mapping.github?.protectedBranches || ['main', 'master', 'develop'];
  const ciNames = mapping.github?.ciWorkflowNames || ['CI'];

  if (conclusion !== 'failure') return [];
  if (!protectedBranches.includes(branch)) return [];
  if (!ciNames.some((n) => name.toLowerCase().includes(String(n).toLowerCase()))) return [];

  return [
    {
      topicKey: 'cicd',
      kind: 'github_ci_failed',
      workflowName: name,
      branch,
      htmlUrl,
    },
  ];
}

/**
 * pull_request merged → General
 */
function routeGithubPullRequestMerged(payload, mapping) {
  const action = payload.action;
  if (action !== 'closed') return [];
  const pr = payload.pull_request || {};
  if (!pr.merged) return [];
  const title = pr.title || '';
  const task = extractTaskIdFromTitle(title);
  const taskId = 'taskId' in task ? task.taskId : null;
  return [
    {
      topicKey: 'general',
      kind: 'github_pr_merged',
      taskId,
      title,
      htmlUrl: pr.html_url || '',
      mergeCommitSha: pr.merge_commit_sha || '',
    },
  ];
}

/**
 * Figma comment_published — filter mentions of team lead
 * @param {object} body Figma webhook JSON
 * @param {object} mapping
 */
function routeFigmaComment(body, mapping) {
  const eventType = body.event_type || body.type || '';
  if (String(eventType).toLowerCase() !== 'comment_published' && String(eventType).toLowerCase() !== 'filecomment') {
    return [];
  }
  const message = body.comment || body.data?.comment || {};
  const text = message.message || message.text || body.message || '';
  const handles = mapping.figma?.teamLeadHandlesInComment || ['@Hoang'];
  const names = mapping.figma?.teamLeadDisplayNames || ['Hoang'];
  const hit =
    handles.some((h) => text.includes(h)) ||
    names.some((n) => new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i').test(text));
  if (!hit) return [];

  const fileKey = body.file_key || body.fileKey || '';
  const commentId = message.id || body.comment_id || '';
  const deepLink =
    fileKey && commentId
      ? `https://www.figma.com/file/${fileKey}?type=design&node-id=${encodeURIComponent(String(commentId))}`
      : body.file_url || '';

  return [
    {
      topicKey: 'design',
      kind: 'figma_comment',
      text,
      deepLink,
      fileKey,
      commentId,
    },
  ];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse mapping from n8n static json string (paste mapping.json minified into workflow variable).
 */
function safeParseMapping(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw || {};
  } catch (e) {
    return { _parseError: String(e && e.message) };
  }
}

/**
 * Build Telegram sendMessage body (MarkdownV2 + optional inline_keyboard).
 * @param {object} row route row from router
 * @param {object} mapping
 */
function buildTelegramSendPayload(row, mapping) {
  const chatId = mapping.telegram?.chatId;
  const topics = mapping.telegram?.topics || {};
  const threadId = topics[row.topicKey];
  if (!chatId || threadId == null) {
    return { skip: true, reason: 'MISSING_CHAT_OR_TOPIC', topicKey: row.topicKey };
  }

  const rowLinks = [];
  if (row.htmlUrl) rowLinks.push({ text: 'Open PR', url: row.htmlUrl });
  if (row.deepLink) rowLinks.push({ text: 'View in Figma', url: row.deepLink });
  const keyboard = rowLinks.length ? { inline_keyboard: [rowLinks] } : undefined;

  let text = '';
  const lines = [];
  if (row.kind === 'github_pr_review') {
    lines.push('🔔 *PR cần review*');
    if (row.taskId) lines.push(`Task: *${escapeMarkdownV2(row.taskId)}*`);
    lines.push(escapeMarkdownV2(row.title || ''));
    if (row.authorLogin) {
      lines.push(`Author: ${escapeMarkdownV2(row.authorLogin)}`);
    }
    if (row.authorTg && row.authorTg.handle) {
      lines.push(`Ping: ${formatPlainAt(row.authorTg)}`);
    }
    if (row.reviewerMentions && row.reviewerMentions.length) {
      lines.push(
        'Reviewers: ' + row.reviewerMentions.map((u) => formatPlainAt(u)).join(' ')
      );
    }
  } else if (row.kind === 'github_ci_failed') {
    lines.push('⛔ *CI failed*');
    lines.push(escapeMarkdownV2(row.workflowName || 'workflow'));
    lines.push(escapeMarkdownV2(row.branch || ''));
  } else if (row.kind === 'github_pr_merged') {
    lines.push('✅ *PR merged*');
    if (row.taskId) lines.push(`Task: *${escapeMarkdownV2(row.taskId)}*`);
    lines.push(escapeMarkdownV2(row.title || ''));
  } else if (row.kind === 'figma_comment') {
    lines.push('🎨 *Figma comment*');
    lines.push(escapeMarkdownV2((row.text || '').slice(0, 500)));
  } else {
    lines.push(escapeMarkdownV2(JSON.stringify(row).slice(0, 300)));
  }
  text = lines.join('\n');

  return {
    skip: false,
    chat_id: chatId,
    message_thread_id: threadId,
    text,
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  };
}

/* ---------- Example n8n Code node return (GitHub path) ----------
const root = $input.first().json;
const headers = root.headers || {};
const event = String(headers['x-github-event'] || headers['X-GitHub-Event'] || '').toLowerCase();
const body = root.body || root;
const mapping = safeParseMapping($vars.mappingJson); // configure in n8n

let out = [];
if (event === 'pull_request') {
  out = out.concat(routeGithubPullRequest(body, mapping));
  out = out.concat(routeGithubPullRequestMerged(body, mapping));
}
if (event === 'workflow_run') {
  out = out.concat(routeGithubWorkflowRun(body, mapping));
}
return out.map((row) => ({ json: row }));
*/
