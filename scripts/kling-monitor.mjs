#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4319;
const DEFAULT_INTERVAL_SECONDS = 15;
const MAX_TASKS = 100;
const RESOURCE = "https://klingai.com/mcp";
const PROTECTED_RESOURCE_URL = "https://klingai.com/.well-known/oauth-protected-resource/mcp";
const OAUTH_METADATA_URL = "https://klingai.com/auth/.well-known/oauth-authorization-server";
const AUTH_RECONNECT_MESSAGE = "可灵授权已失效或账号已切换。请点击“连接可灵账号”重新授权正确账号，然后同步最新状态。";
const ACCOUNT_ACCESS_MESSAGE =
  "当前连接的可灵账号无法访问这个任务。若任务是在切换账号前创建的，请连接创建该任务的账号；否则可移除此记录。";
const FALLBACK_VERSION = "1.0.0+cursor.20260716170100";
const MONITOR_VERSION = readOwnVersion();
const PAGE_TEMPLATE = readFileSync(new URL("../ui/task-monitor.html", import.meta.url), "utf8");
const LOGO_DATA_URI = `data:image/png;base64,${readFileSync(
  new URL("../assets/kling-logo.png", import.meta.url)
).toString("base64")}`;

function readOwnVersion() {
  // This script may be copied standalone into a host project whose own
  // package.json is unrelated, so failures here must not be fatal.
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.name === "kling-ai-cursor-plugin" && pkg.version ? pkg.version : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    generationId: "",
    taskTraceId: "",
    daemon: false,
    open: true,
    help: false
  };

  for (const arg of argv) {
    if (arg === "--daemon") options.daemon = true;
    else if (arg === "--no-open") options.open = false;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--port=")) options.port = Number(arg.slice(7));
    else if (arg.startsWith("--interval-seconds=")) options.intervalSeconds = Number(arg.slice(19));
    else if (arg.startsWith("--generation-id=")) options.generationId = arg.slice(16);
    else if (arg.startsWith("--task-trace-id=")) options.taskTraceId = arg.slice(16);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("--port must be an integer from 1 to 65535");
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds < 5) {
    throw new Error("--interval-seconds must be at least 5");
  }
  return options;
}

function validateIdentifier(value, name, { required = true, max = 256 } = {}) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${name} is required`);
  if (trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error(`${name} is invalid`);
  }
  return trimmed;
}

function validateTaskTraceId(value) {
  const trimmed = validateIdentifier(value || "", "taskTraceId", { required: false, max: 64 });
  if (trimmed && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("taskTraceId must be a UUID");
  }
  return trimmed;
}

function printHelp() {
  console.log(`Kling AI local task monitor

Usage:
  node scripts/kling-monitor.mjs [options]

Options:
  --generation-id=<id>       Register a Kling generation id
  --task-trace-id=<uuid>     Optional UUID v7 used for the generation
  --interval-seconds=<n>     Poll interval, default ${DEFAULT_INTERVAL_SECONDS}
  --port=<n>                 Local port, default ${DEFAULT_PORT}
  --daemon                   Reuse or start a detached monitor
  --no-open                  Do not open the monitor page
  --help                     Show this help

The server binds only to ${HOST}. OAuth tokens stay in memory and are never logged.`);
}

function parseEventStream(text, expectedId) {
  const messages = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) continue;
    try {
      messages.push(JSON.parse(data));
    } catch {
      // Ignore keepalive or non-JSON SSE messages.
    }
  }
  return messages.find((message) => message.id === expectedId) || messages.at(-1) || null;
}

async function parseMcpEnvelope(response, expectedId) {
  if (response.status === 202 || response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") || "";
  const message = contentType.includes("text/event-stream")
    ? parseEventStream(text, expectedId)
    : JSON.parse(text);
  if (message?.error) {
    throw new Error(message.error.message || "MCP request failed");
  }
  return message;
}

function toolPayload(result) {
  if (result?.structuredContent) return result.structuredContent;
  for (const item of result?.content || []) {
    if (item.type !== "text" || typeof item.text !== "string") continue;
    try {
      return JSON.parse(item.text);
    } catch {
      return { message: item.text };
    }
  }
  return result || {};
}

function toolErrorMessage(result) {
  const payload = toolPayload(result);
  const value = findFirstByKey(
    payload,
    new Set(["message", "error", "errorMessage", "error_message", "detail", "reason"])
  );
  const fallback = typeof payload?.message === "string" ? payload.message : "Kling query_tasks returned an error";
  return String(value || fallback).replace(/https?:\/\/[^\s"'<>]+/g, "[URL omitted]").slice(0, 500);
}

class AuthLostError extends Error {
  constructor(message = AUTH_RECONNECT_MESSAGE) {
    super(message);
    this.name = "AuthLostError";
  }
}

function isAuthLostError(error) {
  return error instanceof AuthLostError;
}

function isAccountAccessErrorMessage(message) {
  return /(\bnot\s*found\b|\b404\b|\bforbidden\b|\bunauthori[sz]ed\b|\bpermission\b|\baccess\b|不存在|未找到|无权|无权限|未授权|账号|账户)/i.test(
    String(message || "")
  );
}

function findFirstByKey(value, keys) {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key) && ["string", "number", "boolean"].includes(typeof child)) return child;
  }
  for (const child of Object.values(value)) {
    const found = findFirstByKey(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function collectUrls(value, output = new Set()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) output.add(match[0]);
  } else if (Array.isArray(value)) {
    for (const child of value) collectUrls(child, output);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectUrls(child, output);
  }
  return [...output];
}

function summarizePayload(payload) {
  const status = String(
    findFirstByKey(
      payload,
      new Set(["status", "state", "taskStatus", "task_status", "generationStatus", "generation_status"])
    ) || "UPDATED"
  ).toUpperCase();
  const terminal = /^(SUCCEEDED|SUCCESS|COMPLETED|COMPLETE|FAILED|ERROR|CANCELLED|CANCELED)$/.test(status);
  return { status, terminal, urls: collectUrls(payload) };
}

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readJson(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function openBrowser(url) {
  const commands =
    process.platform === "darwin"
      ? [["open", [url]]]
      : process.platform === "win32"
        ? [["cmd", ["/c", "start", "", url]]]
        : [["xdg-open", [url]]];
  for (const [command, args] of commands) {
    try {
      const child = spawn(command, args, { detached: true, stdio: "ignore" });
      child.unref();
      return;
    } catch {
      // The URL is also printed, so opening is optional.
    }
  }
}

function pageHtml({ apiToken, intervalSeconds }) {
  const safeToken = JSON.stringify(apiToken).replaceAll("<", "\\u003c");
  return PAGE_TEMPLATE.replaceAll("__API_TOKEN__", safeToken)
    .replaceAll("__POLL_INTERVAL__", String(intervalSeconds))
    .replaceAll("__LOGO_DATA_URI__", LOGO_DATA_URI);
}

function publicTask(task) {
  return {
    generationId: task.generationId,
    taskTraceId: task.taskTraceId,
    status: task.status,
    terminal: task.terminal,
    updatedAt: task.updatedAt,
    error: task.error,
    urls: task.urls,
    payload: task.payload
  };
}

function createMonitor(options) {
  const baseUrl = `http://${HOST}:${options.port}`;
  const redirectUri = `${baseUrl}/oauth/callback`;
  const apiToken = base64url(randomBytes(24));
  const tasks = new Map();
  const events = new Set();
  let oauthMetadata;
  let clientId;
  let oauthState;
  let verifier;
  let tokens;
  let mcpSessionId;
  let nextId = 1;
  let polling = false;
  let lastPollAt = "";

  function snapshot() {
    return {
      monitorVersion: MONITOR_VERSION,
      authenticated: Boolean(tokens?.access_token),
      intervalSeconds: options.intervalSeconds,
      polling,
      lastPollAt,
      tasks: [...tasks.values()].map(publicTask)
    };
  }

  function broadcast() {
    const data = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const response of events) response.write(data);
  }

  function addTask(generationId, taskTraceId = "") {
    const id = validateIdentifier(generationId, "generationId");
    const traceId = validateTaskTraceId(taskTraceId);
    if (!tasks.has(id) && tasks.size >= MAX_TASKS) throw new Error(`At most ${MAX_TASKS} tasks can be monitored`);
    const existing = tasks.get(id);
    const shouldReset = Boolean(existing?.error || ["NEEDS_AUTH", "NEEDS_ACCOUNT"].includes(existing?.status));
    tasks.set(id, {
      generationId: id,
      taskTraceId: traceId,
      status: shouldReset ? "WAITING" : existing?.status || "WAITING",
      terminal: shouldReset ? false : existing?.terminal || false,
      updatedAt: existing?.updatedAt || "",
      error: "",
      urls: existing?.urls || [],
      payload: existing?.payload || null
    });
    broadcast();
  }

  function removeTask(generationId) {
    tasks.delete(validateIdentifier(generationId, "generationId"));
    broadcast();
  }

  function disconnect() {
    clearAuth();
    broadcast();
  }

  function clearAuth() {
    tokens = undefined;
    oauthState = undefined;
    verifier = undefined;
    mcpSessionId = undefined;
  }

  function authLost(message = AUTH_RECONNECT_MESSAGE) {
    clearAuth();
    return new AuthLostError(message);
  }

  async function metadata() {
    if (oauthMetadata) return oauthMetadata;
    const [resourceResponse, authResponse] = await Promise.all([
      fetch(PROTECTED_RESOURCE_URL, { headers: { accept: "application/json" } }),
      fetch(OAUTH_METADATA_URL, { headers: { accept: "application/json" } })
    ]);
    if (!resourceResponse.ok || !authResponse.ok) throw new Error("Unable to load Kling OAuth metadata");
    const resourceMetadata = await resourceResponse.json();
    oauthMetadata = await authResponse.json();
    if (resourceMetadata.resource !== RESOURCE) throw new Error("Unexpected Kling OAuth resource");
    return oauthMetadata;
  }

  async function ensureClient() {
    if (clientId) return clientId;
    const info = await metadata();
    const response = await fetch(info.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_name: "Kling AI Local Task Monitor",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none"
      })
    });
    if (!response.ok) throw new Error(`Kling OAuth client registration failed (${response.status})`);
    const registered = await response.json();
    if (!registered.client_id) throw new Error("Kling OAuth registration returned no client_id");
    clientId = registered.client_id;
    return clientId;
  }

  async function authorizationUrl() {
    if (oauthState) throw new Error("An OAuth authorization is already in progress");
    const info = await metadata();
    const id = await ensureClient();
    oauthState = base64url(randomBytes(24));
    verifier = base64url(randomBytes(48));
    const challenge = base64url(createHash("sha256").update(verifier).digest());
    const url = new URL(info.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "generation.read");
    url.searchParams.set("resource", RESOURCE);
    url.searchParams.set("state", oauthState);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async function exchangeCode(code) {
    const info = await metadata();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: RESOURCE
    });
    const response = await fetch(info.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body
    });
    if (!response.ok) throw new Error(`Kling OAuth token exchange failed (${response.status})`);
    const value = await response.json();
    tokens = { ...value, expiresAt: Date.now() + Number(value.expires_in || 3600) * 1000 };
    oauthState = undefined;
    verifier = undefined;
    mcpSessionId = undefined;
    broadcast();
    void pollAll();
  }

  async function refreshTokens() {
    if (!tokens?.refresh_token) throw authLost();
    const info = await metadata();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
      resource: RESOURCE
    });
    const response = await fetch(info.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body
    });
    if (!response.ok) throw authLost();
    const value = await response.json();
    tokens = {
      ...tokens,
      ...value,
      refresh_token: value.refresh_token || tokens.refresh_token,
      expiresAt: Date.now() + Number(value.expires_in || 3600) * 1000
    };
  }

  async function mcpPost(message, retry = true) {
    if (!tokens?.access_token) throw new AuthLostError("请先在本机任务中心连接可灵账号。");
    if (tokens.expiresAt - Date.now() < 30_000) await refreshTokens();
    const headers = {
      authorization: `Bearer ${tokens.access_token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream"
    };
    if (mcpSessionId) headers["mcp-session-id"] = mcpSessionId;
    const response = await fetch(RESOURCE, { method: "POST", headers, body: JSON.stringify(message) });
    if (response.status === 401 && retry && tokens.refresh_token) {
      await refreshTokens();
      mcpSessionId = undefined;
      return mcpPost(message, false);
    }
    if (response.status === 401 || response.status === 403) throw authLost();
    if (!response.ok) throw new Error(`Kling MCP request failed (${response.status})`);
    const session = response.headers.get("mcp-session-id");
    if (session) mcpSessionId = session;
    return parseMcpEnvelope(response, message.id);
  }

  async function ensureMcp() {
    if (mcpSessionId) return;
    const id = nextId++;
    await mcpPost({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "kling-ai-local-monitor", version: "1.0.0" }
      }
    });
    await mcpPost({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  }

  async function queryTask(task) {
    await ensureMcp();
    const id = nextId++;
    const args = { generationId: task.generationId };
    if (task.taskTraceId) args.taskTraceId = task.taskTraceId;
    const envelope = await mcpPost({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: "query_tasks", arguments: args }
    });
    const result = envelope?.result;
    if (result?.isError) {
      const message = toolErrorMessage(result);
      if (isAccountAccessErrorMessage(message)) {
        Object.assign(task, {
          status: "NEEDS_ACCOUNT",
          terminal: true,
          error: ACCOUNT_ACCESS_MESSAGE,
          updatedAt: new Date().toISOString()
        });
        return;
      }
      throw new Error(message);
    }
    const payload = toolPayload(result);
    const summary = summarizePayload(payload);
    Object.assign(task, {
      payload,
      status: summary.status,
      terminal: summary.terminal,
      urls: summary.urls,
      error: "",
      updatedAt: new Date().toISOString()
    });
  }

  async function pollAll() {
    if (polling || !tokens?.access_token) return;
    const active = [...tasks.values()].filter((task) => !task.terminal);
    if (!active.length) return;
    polling = true;
    try {
      for (const task of active) {
        task.status = "QUERYING";
        task.error = "";
        broadcast();
        try {
          await queryTask(task);
        } catch (error) {
          if (isAuthLostError(error)) {
            const updatedAt = new Date().toISOString();
            for (const activeTask of active) {
              Object.assign(activeTask, {
                status: "NEEDS_AUTH",
                error: error.message || AUTH_RECONNECT_MESSAGE,
                updatedAt
              });
            }
            mcpSessionId = undefined;
            break;
          } else {
            task.status = "RETRYING";
            task.error = error.message;
            task.updatedAt = new Date().toISOString();
            mcpSessionId = undefined;
          }
        }
        broadcast();
      }
    } finally {
      polling = false;
      lastPollAt = new Date().toISOString();
      broadcast();
    }
  }

  function isAllowed(request) {
    const address = request.socket.remoteAddress || "";
    if (!address.includes("127.0.0.1") && address !== "::1" && !address.endsWith("::ffff:127.0.0.1")) return false;
    const host = request.headers.host || "";
    return host === `${HOST}:${options.port}` || host === `localhost:${options.port}`;
  }

  function isMutationAllowed(request) {
    if (request.headers["x-kling-monitor-token"] === apiToken) return true;
    return request.headers["x-kling-monitor-daemon"] === MONITOR_VERSION &&
      !request.headers.origin && !request.headers.referer;
  }

  const server = createServer(async (request, response) => {
    try {
      if (!isAllowed(request)) return json(response, 403, { error: "Loopback access only" });
      const url = new URL(request.url, baseUrl);
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data: https:; media-src https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          "referrer-policy": "no-referrer",
          "permissions-policy": "camera=(), microphone=(), geolocation=()",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY"
        });
        response.end(pageHtml({ apiToken, intervalSeconds: options.intervalSeconds }));
      } else if (request.method === "GET" && url.pathname === "/api/state") {
        json(response, 200, snapshot());
      } else if (request.method === "GET" && url.pathname === "/events") {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive"
        });
        events.add(response);
        response.write(`data: ${JSON.stringify(snapshot())}\n\n`);
        request.on("close", () => events.delete(response));
      } else if (request.method === "GET" && url.pathname === "/auth/start") {
        response.writeHead(302, { location: await authorizationUrl(), "cache-control": "no-store" });
        response.end();
      } else if (request.method === "GET" && url.pathname === "/oauth/callback") {
        if (!url.searchParams.get("code") || url.searchParams.get("state") !== oauthState) {
          throw new Error("Invalid OAuth callback state");
        }
        await exchangeCode(url.searchParams.get("code"));
        response.writeHead(302, { location: "/?connected=1", "cache-control": "no-store" });
        response.end();
      } else if (request.method === "POST" && url.pathname === "/api/tasks") {
        if (!isMutationAllowed(request)) return json(response, 403, { error: "Invalid local request" });
        const body = await readJson(request);
        addTask(body.generationId, body.taskTraceId);
        json(response, 201, snapshot());
        void pollAll();
      } else if (request.method === "POST" && url.pathname === "/api/tasks/remove") {
        if (!isMutationAllowed(request)) return json(response, 403, { error: "Invalid local request" });
        const body = await readJson(request);
        removeTask(body.generationId);
        json(response, 200, snapshot());
      } else if (request.method === "POST" && url.pathname === "/api/poll") {
        if (!isMutationAllowed(request)) return json(response, 403, { error: "Invalid local request" });
        await readJson(request);
        void pollAll();
        json(response, 202, snapshot());
      } else if (request.method === "POST" && url.pathname === "/api/disconnect") {
        if (!isMutationAllowed(request)) return json(response, 403, { error: "Invalid local request" });
        await readJson(request);
        disconnect();
        json(response, 200, snapshot());
      } else if (request.method === "GET" && url.pathname === "/health") {
        json(response, 200, {
          ok: true,
          monitorVersion: MONITOR_VERSION,
          authenticated: Boolean(tokens?.access_token)
        });
      } else {
        json(response, 404, { error: "Not found" });
      }
    } catch (error) {
      json(response, 400, { error: error.message });
    }
  });

  const timer = setInterval(() => void pollAll(), options.intervalSeconds * 1000);
  timer.unref();

  return {
    baseUrl,
    addTask,
    snapshot,
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port, HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
    },
    close() {
      clearInterval(timer);
      for (const response of events) response.end();
      return new Promise((resolve) => server.close(resolve));
    }
  };
}

async function registerWithExisting(options) {
  try {
    const stateResponse = await fetch(`http://${HOST}:${options.port}/api/state`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(1000)
    });
    if (!stateResponse.ok) return false;
    const state = await stateResponse.json();
    if (state.monitorVersion !== MONITOR_VERSION) {
      const running = state.monitorVersion || "legacy";
      throw new Error(
        `Kling monitor ${running} is already running on port ${options.port}; stop it before starting ${MONITOR_VERSION}`
      );
    }
    if (!options.generationId) return true;
    const response = await fetch(`http://${HOST}:${options.port}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kling-monitor-daemon": MONITOR_VERSION },
      body: JSON.stringify({ generationId: options.generationId, taskTraceId: options.taskTraceId }),
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch (error) {
    if (error.message?.startsWith("Kling monitor ")) throw error;
    return false;
  }
}

async function startDaemon(options) {
  const baseUrl = `http://${HOST}:${options.port}`;
  if (await registerWithExisting(options)) {
    console.log(`Kling monitor: ${baseUrl}`);
    if (options.open) openBrowser(baseUrl);
    return;
  }

  const forwarded = process.argv.slice(2).filter((arg) => arg !== "--daemon");
  const child = spawn(process.execPath, [process.argv[1], ...forwarded], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, KLING_MONITOR_DAEMON_CHILD: "1" }
  });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting Kling monitor")), 5000);
    child.stdout.setEncoding("utf8");
    child.stdout.once("data", (data) => {
      clearTimeout(timer);
      resolve(data.trim());
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Kling monitor exited during startup (${code})`));
    });
  });
  child.stdout.destroy();
  child.unref();
  console.log(ready || `Kling monitor: ${baseUrl}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (options.daemon && !process.env.KLING_MONITOR_DAEMON_CHILD) return startDaemon(options);

  const monitor = createMonitor(options);
  if (options.generationId) monitor.addTask(options.generationId, options.taskTraceId);
  await monitor.listen();
  console.log(`Kling monitor: ${monitor.baseUrl}`);
  if (options.open) openBrowser(monitor.baseUrl);

  const stop = async () => {
    await monitor.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

export {
  collectUrls,
  createMonitor,
  isAccountAccessErrorMessage,
  parseArgs,
  parseEventStream,
  registerWithExisting,
  summarizePayload,
  toolErrorMessage,
  toolPayload
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Kling monitor failed: ${error.message}`);
    process.exit(1);
  });
}
