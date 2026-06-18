const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".pdf":  "application/pdf",
  ".json": "application/json",
};

function limparJSON(texto) {
  // Remove blocos de markdown ```json ... ``` ou ``` ... ```
  return texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  // ── PROXY PARA A API DO GEMINI ──
  if (req.method === "POST" && url === "/api/analyze") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        if (!GEMINI_API_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Chave da API não configurada no servidor." }));
          return;
        }

        const payload = JSON.parse(body);

        const systemPrompt = payload.system || "";
        const userMessage = payload.messages?.[0];

        let userText = "";
        let pdfBase64 = null;

        if (typeof userMessage?.content === "string") {
          userText = userMessage.content;
        } else if (Array.isArray(userMessage?.content)) {
          for (const part of userMessage.content) {
            if (part.type === "text") userText = part.text;
            if (part.type === "document" && part.source?.type === "base64") {
              pdfBase64 = part.source.data;
            }
          }
        }

        const parts = [];

        if (pdfBase64) {
          parts.push({
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64
            }
          });
        }

        // Instrução reforçada para o Gemini retornar JSON puro
        const promptFinal = systemPrompt + "\n\nIMPORTANTE: Retorne SOMENTE o objeto JSON, sem markdown, sem blocos de código, sem texto antes ou depois.\n\n" + userText;
        parts.push({ text: promptFinal });

        const geminiPayload = {
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"  // Força JSON puro no Gemini 1.5
          }
        };

        const https = require("https");
        const postData = JSON.stringify(geminiPayload);
        const geminiPath = `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const options = {
          hostname: "generativelanguage.googleapis.com",
          path: geminiPath,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = "";
          apiRes.on("data", chunk => data += chunk);
          apiRes.on("end", () => {
            try {
              const geminiResponse = JSON.parse(data);

              // Log para debug nos logs do Render
              console.log("Status Gemini:", apiRes.statusCode);

              if (apiRes.statusCode !== 200) {
                console.error("Erro Gemini:", data);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Erro da API Gemini: " + (geminiResponse?.error?.message || data) }));
                return;
              }

              let text = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "";

              // Limpa markdown caso venha mesmo com responseMimeType
              text = limparJSON(text);

              // Valida que é JSON válido antes de enviar
              try {
                JSON.parse(text);
              } catch {
                console.error("Gemini não retornou JSON válido:", text.substring(0, 300));
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "A IA não retornou um formato válido. Tente novamente." }));
                return;
              }

              const claudeFormat = {
                content: [{ type: "text", text }]
              };

              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify(claudeFormat));

            } catch (parseErr) {
              console.error("Erro parse:", parseErr.message);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Erro ao processar resposta da IA." }));
            }
          });
        });

        apiReq.on("error", (err) => {
          console.error("Erro conexão:", err.message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Erro ao conectar com a IA: " + err.message }));
        });

        apiReq.write(postData);
        apiReq.end();

      } catch (err) {
        console.error("Erro geral:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Requisição inválida: " + err.message }));
      }
    });
    return;
  }

  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
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