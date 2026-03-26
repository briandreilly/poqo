import coreData from "../../constitution/core.json" with { type: "json" };
import defaultProfileData from "../../profiles/default.json" with { type: "json" };
import founderProfileData from "../../profiles/founder.json" with { type: "json" };
import kidsafeProfileData from "../../profiles/kidsafe.json" with { type: "json" };

import type { ConstitutionCore, Profile, PromptGuide, RuntimeGuide, TermSubstitution, ToneHint } from "../types.js";

// poqo has one real Constitution source. Profile overlays are loaded separately
// and validated against a presentation-only surface.
const allowedProfileIds = new Set<Profile["id"]>(["default", "founder", "kidsafe"]);
const allowedToneHints = new Set<ToneHint>(["plain", "concise", "inspectable", "practical", "low-drama", "gentle", "age-clear"]);
const controlPattern = /\b(direct|narrow|prove|proof|route|routing|calm|counter|blunt|domain|frame|constitution|profile|override)\b/i;
const rawProfiles = {
  default: defaultProfileData,
  founder: founderProfileData,
  kidsafe: kidsafeProfileData
} as const;

function assertProfileId(value: unknown, field: string): Profile["id"] {
  const id = assertString(value, field) as Profile["id"];

  if (!allowedProfileIds.has(id)) {
    throw new Error(`Unsupported profile id: ${id}`);
  }

  return id;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid field: ${field}`);
  }

  return value.trim();
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Invalid field: ${field}`);
  }

  return value.map((item) => item.trim());
}

function assertShortPresentationString(value: unknown, field: string, maxLength: number): string {
  const text = assertString(value, field);

  if (text.length > maxLength || /[\n\r]/.test(text)) {
    throw new Error(`Invalid presentation field: ${field}`);
  }

  return text;
}

function assertToneHints(value: unknown, field: string): ToneHint[] {
  const hints = assertStringArray(value, field);

  if (hints.length === 0 || hints.length > 4) {
    throw new Error(`Invalid tone hint count in ${field}`);
  }

  const seen = new Set<string>();

  for (const hint of hints) {
    if (!allowedToneHints.has(hint as ToneHint)) {
      throw new Error(`Unsupported tone hint in ${field}: ${hint}`);
    }

    if (seen.has(hint)) {
      throw new Error(`Duplicate tone hint in ${field}: ${hint}`);
    }

    seen.add(hint);
  }

  return hints as ToneHint[];
}

function assertResponseLabels(value: unknown): Profile["responseLabels"] {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid field: responseLabels");
  }

  const labels = value as Record<string, unknown>;

  return {
    direct: assertShortPresentationString(labels.direct, "responseLabels.direct", 32),
    narrow: assertShortPresentationString(labels.narrow, "responseLabels.narrow", 32),
    prove: assertShortPresentationString(labels.prove, "responseLabels.prove", 32)
  };
}

function assertPresentationSubstitutions(value: unknown): TermSubstitution[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length > 6) {
    throw new Error("Too many termSubstitutions entries");
  }

  const seen = new Set<string>();

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid termSubstitutions entry at index ${index}`);
    }

    const record = entry as Record<string, unknown>;
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

function validateCore(data: unknown): ConstitutionCore {
  if (!data || typeof data !== "object") {
    throw new Error("Constitution core must contain an object");
  }

  const value = data as Record<string, unknown>;
  const identity = value.identity as Record<string, unknown>;
  const purpose = value.purpose as Record<string, unknown>;

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

function validateProfile(data: unknown): Profile {
  if (!data || typeof data !== "object") {
    throw new Error("Profile file must contain an object");
  }

  // Profiles are intentionally tiny. If a new field seems useful but could
  // influence routing, proof, posture, or domain lock, it belongs elsewhere.
  const value = data as Record<string, unknown>;

  return {
    id: assertProfileId(value.id, "id"),
    title: assertShortPresentationString(value.title, "title", 32),
    toneHints: assertToneHints(value.toneHints, "toneHints"),
    responseLabels: assertResponseLabels(value.responseLabels),
    termSubstitutions: assertPresentationSubstitutions(value.termSubstitutions)
  };
}

function buildPromptGuide(core: ConstitutionCore, profile: Profile): PromptGuide {
  return {
    role: core.identity.role,
    mission: core.purpose.mission,
    toneHints: profile.toneHints,
    defaultBehavior: core.defaultBehavior,
    forbiddenBehavior: core.forbiddenBehavior,
    humanOverride: core.humanOverride
  };
}

export async function loadCoreConstitution(): Promise<ConstitutionCore> {
  return validateCore(coreData);
}

export async function loadProfile(id: string): Promise<Profile> {
  const rawProfile = rawProfiles[id as keyof typeof rawProfiles];

  if (!rawProfile) {
    throw new Error(`Unsupported profile id: ${id}`);
  }

  return validateProfile(rawProfile);
}

export async function loadRuntimeGuide(id: string): Promise<RuntimeGuide> {
  const [core, profile] = await Promise.all([loadCoreConstitution(), loadProfile(id)]);

  return {
    profile,
    // Runtime receives only a distilled prompt guide so profile data stays in
    // presentation territory and cannot silently grow into operating logic.
    promptGuide: buildPromptGuide(core, profile)
  };
}

export async function listProfiles(): Promise<Array<Pick<Profile, "id" | "title">>> {
  const profiles = await Promise.all(
    Object.values(rawProfiles).map(async (rawProfile) => {
      const profile = validateProfile(rawProfile);
      return {
        id: profile.id,
        title: profile.title
      };
    })
  );

  return profiles.sort((a, b) => a.id.localeCompare(b.id));
}
