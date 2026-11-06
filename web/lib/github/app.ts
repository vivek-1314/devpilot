import "server-only";
import fs from "node:fs";
import path from "node:path";
import { App } from "octokit";

function loadPrivateKey(): string {
    const filePath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const b64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    let key = "";

    if (filePath) {
        key = fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
    } else if (b64) {
        key = Buffer.from(b64.trim().replace(/^["']|["']$/g, ""), "base64").toString("utf8");
    }

    key = key.trim();
    if (!key.startsWith("-----BEGIN")) {
        throw new Error(
            "GitHub private key is missing or invalid. Set GITHUB_APP_PRIVATE_KEY_PATH to your .pem file."
        );
    }
    return key;
}

export const githubApp = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: loadPrivateKey(),
    oauth: {
        clientId: process.env.GITHUB_APP_CLIENT_ID!,
        clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
    },
});