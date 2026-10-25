// Local stand-in for Vercel's routing: one address, localhost:3000, in front
// of the two dev servers (admin on :3001, booking on :3002), applying the
// rules in rules.mjs, the same ones vercel.json is written from. So every
// surface works on one origin in path mode, and on *.localhost:3000 in
// subdomain mode, like production. Requests and their
// Host header are passed through untouched; websockets too (hot reload).
//
// Started by `npm run dev` and `npm start`. PORT, ADMIN_PORT and
// BOOKING_PORT change the ports.
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { serviceFor } from "./match.mjs";
import { rewrites, routingMode } from "./rules.mjs";

const root = path.resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const env = process.env;
const ports = { admin: Number(env.ADMIN_PORT || 3001), booking: Number(env.BOOKING_PORT || 3002) };
const table = rewrites(env);

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://router");
  const service = serviceFor(table, pathname, req.headers.host);
  const upstream = http.request(
    { host: "127.0.0.1", port: ports[service], method: req.method, path: req.url, headers: req.headers },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.statusMessage, reply.rawHeaders);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`The ${service} app isn't answering on :${ports[service]} yet. Is it still starting?`);
  });
  req.pipe(upstream);
});

// Hot reload and anything else that upgrades the connection.
server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://router");
  const port = ports[serviceFor(table, pathname, req.headers.host)];
  const upstream = net.connect(port, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

const port = Number(env.PORT || 3000);
server.listen(port, () => {
  const mode = routingMode(env);
  const site = mode === "path" ? `http://localhost:${port}` : `http://*.localhost:${port}`;
  console.log(`Router on ${site} (${mode} mode): admin :${ports.admin}, booking :${ports.booking}`);
});
