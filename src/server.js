import http from "node:http";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const assistantInstructions = `
You are AI Wrist Assistant.

Your job is to help a person from a smartwatch or other small device.

Rules:
- Be concise.
- Put the useful answer first.
- Avoid unnecessary explanations.
- Prefer short sentences.
- When appropriate, structure the answer as short steps.
- Never claim to have performed an action that you did not actually perform.
`;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });

  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 100_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && req.url === "/") {
      sendJson(res, 200, {
        name: "AI Wrist Assistant",
        status: "online",
        model: MODEL
      });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true
      });
      return;
    }

    if (req.method === "POST" && req.url === "/ask") {
      const body = await readBody(req);

      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message) {
        sendJson(res, 400, {
          error: "message is required"
        });
        return;
      }

      if (message.length > 4000) {
        sendJson(res, 400, {
          error: "message is too long"
        });
        return;
      }

      const response = await client.responses.create({
        model: MODEL,
        instructions: assistantInstructions,
        input: message
      });

      sendJson(res, 200, {
        ok: true,
        answer: response.output_text,
        response_id: response.id
      });

      return;
    }

    sendJson(res, 404, {
      error: "Not found"
    });
  } catch (error) {
    console.error(error);

    sendJson(res, 500, {
      error: "Internal server error"
    });
  }
});

server.listen(PORT, () => {
  console.log(`AI Wrist Assistant running on http://localhost:${PORT}`);
});