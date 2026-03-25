import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
// poqo has one real Constitution source. Profile overlays are loaded separately
// and validated against a presentation-only surface.
const corePath = path.join(process.cwd(), "constitution", "core.json");
const profilesDir = path.join(process.cwd(), "profiles");
const allowedProfileIds = new Set(["default", "founder", "kidsafe"]);
const allowedToneHints = new Set(["plain", "concise", "inspectable", "practical", "low-drama", "gentle", "age-clear"]);
const controlPattern = /\b(direct|narrow|prove|proof|route|routing|calm|counter|blunt|domain|frame|constitution|profile|override)\b/i;
function assertProfileId(value, field) {
    const id = assertString(value, field);
    if (!allowedProfileIds.has(id)) {
        throw new Error(`Unsupported profile id: ${id}`);
    }
    return id;
}
function assertString(value, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Invalid field: ${field}`);
    }
    return value.trim();
}
function assertStringArray(value, field) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
        throw new Error(`Invalid field: ${field}`);
    }
    return value.map((item) => item.trim());
}
function assertShortPresentationString(value, field, maxLength) {
    const text = assertString(value, field);
    if (text.length > maxLength || /[\n\r]/.test(text)) {
        throw new Error(`Invalid presentation field: ${field}`);
    }
    return text;
}
function assertToneHints(value, field) {
    const hints = assertStringArray(value, field);
    if (hints.length === 0 || hints.length > 4) {
        throw new Error(`Invalid tone hint count in ${field}`);
    }
    const seen = new Set();
    for (const hint of hints) {
        if (!allowedToneHints.has(hint)) {
            throw new Error(`Unsupported tone hint in ${field}: ${hint}`);
        }
        if (seen.has(hint)) {
            throw new Error(`Duplicate tone hint in ${field}: ${hint}`);
        }
        seen.add(hint);
    }
    return hints;
}
function assertResponseLabels(value) {
    if (!value || typeof value !== "object") {
        throw new Error("Invalid field: responseLabels");
    }
    const labels = value;
    return {
        direct: assertShortPresentationString(labels.direct, "responseLabels.direct", 32),
        narrow: assertShortPresentationString(labels.narrow, "responseLabels.narrow", 32),
        prove: assertShortPresentationString(labels.prove, "responseLabels.prove", 32)
    };
}
function assertPresentationSubstitutions(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    if (value.length > 6) {
        throw new Error("Too many termSubstitutions entries");
    }
    const seen = new Set();
    return value.map((entry, index) => {
        if (!entry || typeof entry !== "object") {
            throw new Error(`Invalid termSubstitutions entry at index ${index}`);
        }
        const record = entry;
        const from = assertShortPresentationString(record.from, `termSubstitutions[${index}].from`, 24).toLowerCase();
        const to = assertShortPresentationString(record.to, `termSubstitutions[${index}].to`, 24).toLowerCase();
        if (controlPattern.test(from) || controlPattern.test(to)) {
            throw new Error(`Profile substitution cannot contain control language at index ${index}`);
        }
        if (from === to) {
            throw new Error(`Profile substitution cannot map a term to itself at index ${index}`);
        }
        if (seen.has(from)) {
            throw new Error(`Duplicate profile substitution source at index ${index}: ${from}`);
        }
        seen.add(from);
        return { from, to };
    });
}
function validateCore(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Constitution core must contain an object");
    }
    const value = data;
    const identity = value.identity;
    const purpose = value.purpose;
    return {
        identity: {
            role: assertString(identity.role, "identity.role")
        },
        purpose: {
            mission: assertString(purpose.mission, "purpose.mission")
        },
        defaultBehavior: assertStringArray(value.defaultBehavior, "defaultBehavior"),
        forbiddenBehavior: assertStringArray(value.forbiddenBehavior, "forbiddenBehavior"),
        humanOverride: assertString(value.humanOverride, "humanOverride")
    };
}
function validateProfile(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Profile file must contain an object");
    }
    // Profiles are intentionally tiny. If a new field seems useful but could
    // influence routing, proof, posture, or domain lock, it belongs elsewhere.
    const value = data;
    return {
        id: assertProfileId(value.id, "id"),
        title: assertShortPresentationString(value.title, "title", 32),
        toneHints: assertToneHints(value.toneHints, "toneHints"),
        responseLabels: assertResponseLabels(value.responseLabels),
        termSubstitutions: assertPresentationSubstitutions(value.termSubstitutions)
    };
}
function buildPromptGuide(core, profile) {
    return {
        role: core.identity.role,
        mission: core.purpose.mission,
        toneHints: profile.toneHints,
        defaultBehavior: core.defaultBehavior,
        forbiddenBehavior: core.forbiddenBehavior,
        humanOverride: core.humanOverride
    };
}
export async function loadCoreConstitution() {
    const raw = await readFile(corePath, "utf8");
    return validateCore(JSON.parse(raw));
}
export async function loadProfile(id) {
    const raw = await readFile(path.join(profilesDir, `${id}.json`), "utf8");
    return validateProfile(JSON.parse(raw));
}
export async function loadRuntimeGuide(id) {
    const [core, profile] = await Promise.all([loadCoreConstitution(), loadProfile(id)]);
    return {
        profile,
        // Runtime receives only a distilled prompt guide so profile data stays in
        // presentation territory and cannot silently grow into operating logic.
        promptGuide: buildPromptGuide(core, profile)
    };
}
export async function listProfiles() {
    const files = (await readdir(profilesDir)).filter((file) => file.endsWith(".json")).sort();
    const profiles = await Promise.all(files.map(async (file) => {
        const raw = await readFile(path.join(profilesDir, file), "utf8");
        const profile = validateProfile(JSON.parse(raw));
        return {
            id: profile.id,
            title: profile.title
        };
    }));
    return profiles;
}
