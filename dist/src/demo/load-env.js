import { readFileSync } from "node:fs";
import path from "node:path";
function parseEnvValue(rawValue) {
    const trimmed = rawValue.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
export function loadLocalEnv() {
    const envPath = path.join(process.cwd(), ".env");
    try {
        const content = readFileSync(envPath, "utf8");
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                continue;
            }
            const separatorIndex = trimmed.indexOf("=");
            if (separatorIndex <= 0) {
                continue;
            }
            const key = trimmed.slice(0, separatorIndex).trim();
            const value = parseEnvValue(trimmed.slice(separatorIndex + 1));
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
    }
    catch (error) {
        const err = error;
        if (err.code !== "ENOENT") {
            throw error;
        }
    }
}
