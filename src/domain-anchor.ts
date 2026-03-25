import type { DomainAnchor } from "./types.js";

// Domain lock is derived from prompt content and earned carry cues only.
// Profile overlays must never influence anchor detection or carry behavior.

const MINECRAFT_EXPLICIT_PATTERN = /\b(minecraft|villagers?|creepers?|redstone|netherite|diamond armor|survival mode|creative mode|oak wood|oak planks?|cobblestone|elytra|ender chest|ender pearl|nether portal|biome|crafting table|pickaxe|sword)\b/i;
const PRODUCT_UI_EXPLICIT_PATTERN = /\b(product|app|ui|ux|onboarding|billing|support|screen|menu|dashboard|export|notifications?|layout|interface)\b/i;
const HEALTHCARE_EXPLICIT_PATTERN = /\b(healthcare|health care|hospital|insurance|medicaid|medicare|clinic|doctor|doctors|patient|patients)\b/i;

const MINECRAFT_CARRY_SUPPORT_PATTERN = /\b(underground|surface|base|mob|spawn|ore|diamond|armor|cobblestone|oak|villagers?|creepers?|redstone|survival|creative|crafting|biome|nether|elytra|ender|pickaxe|sword)\b/i;
const PRODUCT_UI_CARRY_SUPPORT_PATTERN = /\b(product|app|ui|ux|onboarding|billing|support|screen|menu|dashboard|export|notifications?|layout|interface)\b/i;
const HEALTHCARE_CARRY_SUPPORT_PATTERN = /\b(healthcare|health care|hospital|insurance|medicaid|medicare|clinic|doctor|doctors|patient|patients|medical|treatment)\b/i;

function normalize(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function detectDomainAnchor(input: string): DomainAnchor {
  const normalized = normalize(input);

  if (MINECRAFT_EXPLICIT_PATTERN.test(normalized)) {
    return "minecraft";
  }

  if (PRODUCT_UI_EXPLICIT_PATTERN.test(normalized)) {
    return "product-ui";
  }

  if (HEALTHCARE_EXPLICIT_PATTERN.test(normalized)) {
    return "healthcare";
  }

  return null;
}

export function supportsCarriedDomainAnchor(input: string, carriedAnchor: DomainAnchor): boolean {
  if (!carriedAnchor) {
    return false;
  }

  const normalized = normalize(input);

  if (carriedAnchor === "minecraft") {
    return MINECRAFT_CARRY_SUPPORT_PATTERN.test(normalized);
  }

  if (carriedAnchor === "product-ui") {
    return PRODUCT_UI_CARRY_SUPPORT_PATTERN.test(normalized);
  }

  if (carriedAnchor === "healthcare") {
    return HEALTHCARE_CARRY_SUPPORT_PATTERN.test(normalized);
  }

  return false;
}

export function resolveDomainAnchor(input: string, contextAnchor: DomainAnchor = null): DomainAnchor {
  const explicitAnchor = detectDomainAnchor(input);

  if (explicitAnchor) {
    return explicitAnchor;
  }

  if (supportsCarriedDomainAnchor(input, contextAnchor)) {
    return contextAnchor;
  }

  return null;
}
