import fs from "node:fs";
import http from "node:http";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const CREDENTIALS_PATH = "credentials.json";
const TOKEN_PATH = "token.json";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const PORT = 51823;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const { client_id, client_secret } = JSON.parse(
    fs.readFileSync(CREDENTIALS_PATH, "utf-8")
  ).installed;
  const client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  if (fs.existsSync(TOKEN_PATH)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")));
    return client;
  }

  const authUrl = client.generateAuthUrl({
    access_type: "offline", // so we get a refresh token
    scope: SCOPES,
    prompt: "consent",
  });
  console.log(`Open this URL in a browser signed into Gmail:\n\n${authUrl}\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.end("You can close this tab and go back to the terminal.");
      server.close();
      if (code) resolve(code);
      else reject(new Error(`OAuth error: ${error}`));
    });
    server.listen(PORT);
  });

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return client;
}
