import type {
  ConversationSpeakerType,
  ConversationStance,
  ConversationState,
  ConversationTurnEntry,
  ConversationTurnInput,
  ConversationUpdate
} from "../types.js";

const MAX_TURN_LOG = 6;
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from", "has", "have", "if", "in",
  "into", "is", "it", "its", "of", "on", "or", "so", "that", "the", "their", "there", "they", "this", "to",
  "was", "were", "will", "with", "your", "you", "i", "we", "he", "she", "them", "his", "her", "our", "my",
  "me", "us", "than", "then", "about", "still", "also", "very"
]);

const REFINE_PATTERN = /\b(depends|boundary|boundaries|condition|conditions|scope|qualified|qualify|qualifies|narrow|narrower|specific|example|evidence|controversial|limited|moderation|not uniformly|clearer|sharper|tighter|more precise|supporting detail|context|focus on|shift(?:s|ed)? the argument|character judgment|greatness or character)\b/i;
const NEGATIVE_PATTERN = /\b(should not|shouldn't|not be|does not|doesn't|did not|didn't|cannot|can't|won't|too broad|too absolute|reject|wrong|limited role|very limited|hard no|absolutely not|not best|not uniformly|does not hold up|doesn't hold up|weakens|no)\b/gi;
const POSITIVE_PATTERN = /\b(belongs in|belongs|should be|beneficial|healthy|good|better|best|valid|qualify|qualifies|strong default|strong case|works|reasonable|fair point)\b/gi;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sentenceParts(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? []).map((part) => part.trim()).filter(Boolean);
}

function finalizeLine(text: string): string {
  const trimmed = text.trim().replace(/[.?!]+$/u, "");
  return trimmed ? `${trimmed}.` : "";
}

function extractKeywords(text: string): string[] {
  return Array.from(new Set(
    normalizeText(text)
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  ));
}

function sharedKeywordCount(left: string, right: string): number {
  const leftKeywords = extractKeywords(left);
  const rightKeywords = new Set(extractKeywords(right));
  return leftKeywords.filter((word) => rightKeywords.has(word)).length;
}

function isClearlyDifferentClaim(activeClaim: string, nextClaim: string): boolean {
  if (!activeClaim.trim()) {
    return true;
  }

  const activeKeywords = extractKeywords(activeClaim);
  const nextKeywords = extractKeywords(nextClaim);

  if (activeKeywords.length === 0 || nextKeywords.length === 0) {
    return normalizeText(activeClaim) !== normalizeText(nextClaim);
  }

  const overlap = activeKeywords.filter((word) => nextKeywords.includes(word)).length;
  const union = new Set([...activeKeywords, ...nextKeywords]).size;
  const overlapRatio = union === 0 ? 0 : overlap / union;

  return overlap === 0 || (overlap < 2 && overlapRatio < 0.18);
}

function stripTurnScaffolding(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[-•]\s/u.test(line) && !/^\d+\.\s/u.test(line))
    .filter((line) => !/^Smallest next question:/iu.test(line));

  if (lines.length === 0) {
    return "";
  }

  const firstLine = lines[0];
  const meaningfulLines = lines.length > 1 && !/[.?!]/u.test(firstLine) && firstLine.split(/\s+/).length <= 3
    ? lines.slice(1)
    : lines;

  return meaningfulLines.join(" ").replace(/\s+/g, " ").trim();
}

export function compactConversationTurn(text: string): string {
  const cleaned = stripTurnScaffolding(text)
    .replace(/\bConstraints I am holding:.*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = sentenceParts(cleaned)[0] ?? cleaned;
  const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 20).join(" ");
  return finalizeLine(words) || "No usable position recorded.";
}

function polarityScore(text: string): number {
  const normalized = normalizeText(text);
  const negativeHits = normalized.match(NEGATIVE_PATTERN)?.length ?? 0;
  const positiveHits = normalized.match(POSITIVE_PATTERN)?.length ?? 0;
  return positiveHits - negativeHits;
}

export function classifyConversationStance(activeClaim: string, compactText: string): ConversationStance {
  if (!activeClaim.trim() || !compactText.trim()) {
    return "unrelated";
  }

  const overlap = sharedKeywordCount(activeClaim, compactText);
  if (overlap === 0) {
    return "unrelated";
  }

  const claimPolarity = polarityScore(activeClaim);
  const linePolarity = polarityScore(compactText);

  if (claimPolarity !== 0 && linePolarity !== 0 && Math.sign(claimPolarity) !== Math.sign(linePolarity)) {
    return "contradict";
  }

  if (REFINE_PATTERN.test(compactText)) {
    return "refine";
  }

  return "support";
}

function normalizeSpeakerType(input: ConversationTurnInput): ConversationSpeakerType {
  if (input.speakerType) {
    return input.speakerType;
  }

  if (input.speakerId?.trim() === "poqo") {
    return "poqo";
  }

  return "other";
}

function normalizeTurnInput(input: ConversationTurnInput): Omit<ConversationTurnEntry, "compactText" | "stance" | "targetsActiveClaim"> {
  const speakerType = normalizeSpeakerType(input);
  const speakerId = input.speakerId?.trim()
    ? input.speakerId.trim()
    : speakerType === "poqo"
      ? "poqo"
      : speakerType === "user"
        ? "user-1"
        : speakerType === "external_ai"
          ? "external-ai-1"
          : "unknown-1";

  return {
    speakerId,
    speakerType,
    speakerLabel: input.speakerLabel?.trim() ? input.speakerLabel.trim() : undefined,
    text: input.text.trim()
  };
}

function speakerName(entry: ConversationTurnEntry): string {
  return entry.speakerLabel?.trim() || entry.speakerId;
}

function stanceVerb(stance: ConversationStance): string {
  return stance === "support"
    ? "supported"
    : stance === "contradict"
      ? "contradicted"
      : stance === "refine"
        ? "refined"
        : "not materially engaged";
}

function buildSpeakerSummaryClause(entries: ConversationTurnEntry[]): string | null {
  const meaningfulEntries = entries.filter((entry) => entry.targetsActiveClaim && entry.stance !== "unrelated");
  if (meaningfulEntries.length === 0) {
    return null;
  }

  const counts = new Map<ConversationStance, number>([
    ["support", 0],
    ["contradict", 0],
    ["refine", 0],
    ["unrelated", 0]
  ]);

  for (const entry of meaningfulEntries) {
    counts.set(entry.stance, (counts.get(entry.stance) ?? 0) + 1);
  }

  const dominant = (["support", "contradict", "refine", "unrelated"] as ConversationStance[])
    .sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0))[0];

  return `${speakerName(meaningfulEntries[0])} has mainly ${stanceVerb(dominant)} this claim`;
}

function buildRecentTurnSentence(turnLog: ConversationTurnEntry[]): string {
  const bySpeaker = new Map<string, ConversationTurnEntry[]>();

  for (const entry of turnLog) {
    const existing = bySpeaker.get(entry.speakerId) ?? [];
    existing.push(entry);
    bySpeaker.set(entry.speakerId, existing);
  }

  const clauses = Array.from(bySpeaker.values())
    .map((entries) => ({
      clause: buildSpeakerSummaryClause(entries),
      score: entries.filter((entry) => entry.targetsActiveClaim && entry.stance !== "unrelated").length
    }))
    .filter((item): item is { clause: string; score: number } => Boolean(item.clause))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.clause);

  if (clauses.length === 0) {
    return "Recent turns have not materially engaged this claim yet.";
  }

  if (clauses.length === 1) {
    return `${clauses[0]}.`;
  }

  if (clauses.length === 2) {
    return `${clauses[0]}, while ${clauses[1]}.`;
  }

  return `${clauses[0]}, while ${clauses[1]}, and ${clauses[2]}.`;
}

function buildRunningSummary(activeClaim: string, turnLog: ConversationTurnEntry[], activeClaimChanged: boolean): string {
  const latestTurn = turnLog[turnLog.length - 1];
  const latestRefine = [...turnLog].reverse().find((entry) => entry.targetsActiveClaim && entry.stance === "refine");
  const latestMeaningful = [...turnLog].reverse().find((entry) => entry.targetsActiveClaim);

  const lines = [`Current claim: ${finalizeLine(activeClaim)}`];

  if (activeClaimChanged && latestTurn?.speakerType !== "poqo") {
    lines.push(`${speakerName(latestTurn)} introduced a new claim, so the discussion reset around it.`);
  } else {
    lines.push(buildRecentTurnSentence(turnLog));
  }

  if (latestRefine) {
    lines.push(`Latest boundary: ${latestRefine.compactText}`);
  } else if (latestMeaningful) {
    lines.push(`Latest position: ${latestMeaningful.compactText}`);
  }

  return lines.join(" ").replace(/\s+/g, " ").trim();
}

export function updateConversationState(
  previousState: ConversationState | null | undefined,
  turnInput: ConversationTurnInput
): ConversationUpdate {
  const normalizedTurn = normalizeTurnInput(turnInput);
  const previousActiveClaim = previousState?.activeClaim?.trim() ?? "";
  const compactText = compactConversationTurn(normalizedTurn.text);
  const externalTurn = normalizedTurn.speakerType !== "poqo";

  let activeClaim = previousActiveClaim;
  let activeClaimChanged = false;

  if (externalTurn) {
    if (!previousActiveClaim) {
      activeClaim = normalizedTurn.text;
      activeClaimChanged = true;
    } else if (isClearlyDifferentClaim(previousActiveClaim, normalizedTurn.text)) {
      activeClaim = normalizedTurn.text;
      activeClaimChanged = true;
    }
  }

  let stance: ConversationStance;
  if (!previousActiveClaim && externalTurn) {
    stance = "support";
  } else {
    stance = classifyConversationStance(previousActiveClaim || activeClaim, compactText);
  }

  const latestTurn: ConversationTurnEntry = {
    ...normalizedTurn,
    compactText,
    stance,
    targetsActiveClaim: !activeClaimChanged || !previousActiveClaim
  };

  const turnLog = (activeClaimChanged ? [] : previousState?.turnLog ?? []).concat(latestTurn).slice(-MAX_TURN_LOG);
  const state: ConversationState = {
    activeClaim,
    runningSummary: buildRunningSummary(activeClaim, turnLog, activeClaimChanged),
    turnLog
  };

  return {
    state,
    latestTurn,
    activeClaimChanged
  };
}
