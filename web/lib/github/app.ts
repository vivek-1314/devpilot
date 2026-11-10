import "server-only";
import fs from "node:fs";
import path from "node:path";
import { App } from "octokit";

let cachedApp: App | null = null;

function loadPrivateKey(): string {
    const b64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    const filePath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    let key = "";

    if (b64) {
        key = Buffer.from(b64.trim().replace(/^["']|["']$/g, ""), "base64").toString("utf8");
    } else if (filePath) {
        key = fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
    }

    key = key.trim();
    if (!key.startsWith("-----BEGIN")) {
        throw new Error(
            "GitHub private key is missing or invalid. Set GITHUB_APP_PRIVATE_KEY_BASE64 (preferred) or GITHUB_APP_PRIVATE_KEY_PATH."
        );
    }
    return key;
}

export function getGithubApp(): App {
    if (!cachedApp) {
        cachedApp = new App({
            appId: process.env.GITHUB_APP_ID!,
            privateKey: loadPrivateKey(),
            oauth: {
                clientId: process.env.GITHUB_APP_CLIENT_ID!,
                clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
            },
        });
    }
    return cachedApp;
}