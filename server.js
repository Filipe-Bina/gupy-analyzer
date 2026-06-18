const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".pdf":  "application/pdf",
  ".json": "application/json",
};

http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  // ── PROXY PARA A API DO CLAUDE ──
  if (req.method === "POST" && url === "/api/analyze") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        if (!ANTHROPIC_API_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Chave da API não configurada no servidor." }));
          return;
        }

        const payload = JSON.parse(body);

        // Faz a chamada à API do Claude no servidor (chave nunca vai ao browser)
        const https = require("https");
        const postData = JSON.stringify(payload);

        const options = {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Length": Buffer.byteLength(postData),
          },
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = "";
          apiRes.on("data", chunk => data += chunk);
          apiRes.on("end", () => {
            res.writeHead(apiRes.statusCode, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(data);
          });
        });

        apiReq.on("error", (err) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Erro ao conectar com a IA: " + err.message }));
        });

        apiReq.write(postData);
        apiReq.end();

      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Requisição inválida: " + err.message }));
      }
    });
    return;
  }

  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  // ── ARQUIVOS ESTÁTICOS ──
  const filePath = path.join(__dirname, url === "/" ? "index.html" : url);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log(`Analisador Gupy rodando em http://localhost:${PORT}`);
});
