import type { ProofType, RequestAnalysis, RequestSignals, UtteranceType } from "../types.js";
import { detectDomainAnchor } from "../domain-anchor.js";

const CONSTRAINT_PATTERN =
  /\b(must|must not|should|should not|need to|needs to|under|within|no |without|only|avoid|keep it|budget|local-only|local only|offline|simple|fewest dependencies|single developer|dead simple|tiny|smallest|this week|by friday)\b/i;

const BROAD_PATTERNS = [
  /\bhelp me design\b/i,
  /\bmake this better\b/i,
  /\bplan a launch\b/i,
  /\bwrite the docs\b/i,
  /\bbest architecture\b/i,
  /\bhelp me\b/i,
  /\bfigure out\b/i,
  /\bstuck on\b/i
];

const WORLD_PATTERN =
  /\b(latest|current|today|price|prices|lts|law|legal|rules|regulation|requirements|compliant|coppa|app store|license|maintenance|cite|citation|source|news|statistics|right now)\b/i;

const CHAT_PATTERN =
  /\b(requirements above|constraints above|already stated|this chat|our conversation|as discussed|current scope|locked in|we talked through|we already said|we agreed on|we already agreed|we already locked in|we already nailed down|we've already decided|we've already locked in|we've already nailed down|we already decided|earlier)\b/i;

const MATERIAL_REFERENCE_PATTERN =
  /\b(attached|below|above|pasted|paste|transcript|contract|policy|document|spec|resume|clause|excerpt|line below)\b/i;

const EXPLICIT_PROOF_PATTERN =
  /\b(show .*basis|show what .* stands on|prove|proof|cite|citation|source|based on what|what .* based on)\b/i;

const VAGUE_PRIORITY_PATTERNS = [
  /\bshould i\b.*\b(build|ship|prioriti[sz]e|do)\s+(this feature|this thing|this|that|it)\b/i,
  /\bshould this\b.*\bcome before\b/i,
  /\bis this\b.*\b(next thing|right next thing)\b.*\b(build|ship)\b/i
];

const ANSWERABLE_SUBJECTIVE_PATTERN =
  /^(are|is)\b.+\b(scary|creepy|too hard|hard)\b[?.!]*$/i;
const DIRECT_QUESTION_START_PATTERN = /^(what|where|when|why|how|who|which)\b/i;

const SUBJECTIVE_SAFETY_PATTERN =
  /\b(gun|knife|weapon|kill|killing|hurt me|hurt them|blood|gore|self-harm|suicide|abuse|unsafe|dangerous|adult)\b/i;

const VIOLENCE_RISK_PATTERN =
  /\b(violent|violence|revolution|hurt(?:ing)? them|attack(?:ing)? them|force)\b/i;

const VIOLENCE_SUPPORT_PATTERN =
  /\b(answer|only way|justified|solve it|seems like|would solve it|what then)\b/i;

const GREETING_PATTERN = /^(hey|hi|hello|yo|good morning|good afternoon|good evening)\b[!. ]*$/i;
const EMOTIONAL_REACTION_PATTERN = /^(ugh|wow|oof|ouch|yikes|nice|that sucked|that was fun|long day)\b[!. ]*$/i;
const OBSERVATION_PATTERN = /^(the|it|this|that)\b.*\b(today|finally|sun|weather|rain|snow|out|bright|warm|cold|late|early|quiet|loud|beautiful)\b.*$/i;
const OPINION_STATEMENT_PATTERN = /^(i think|i feel|this feels|this seems|this looks|i guess|i (?:do not |don't |did not |didn't )?like(?:d)?)\b/i;
const STRONG_UNSUPPORTED_STANCE_PATTERN =
  /\b(garbage|trash|useless|insane|propaganda|ruined|destroyed|filthy|will never work|never work|never works|set back\b.*\b(years?|decades?)\b|failure|disaster)\b/i;
const BROAD_TRAIT_REALITY_CLAIM_PATTERN =
  /(?:\b(?:is|are)\s+(?:an?\s+)?(?:honest(?:\s+person)?|dishonest|liar|fraud|corrupt|immoral|safe for everyone|safe for all|safe|unsafe|reliable|unreliable|trustworthy|untrustworthy)\b|\b(?:lacks|lack)\s+moral\s+character\b|\bhas\s+no\s+moral\s+character\b|\bscams everyone\b)/i;
const CONTESTED_FRAMING_DOMAIN_PATTERN =
  /\b(nazi|nazis|fascism|fascist|communism|communist|socialism|socialist|left(?:-wing)?|right(?:-wing)?|authoritarian|movement|regime|party|political labels?|labels?)\b/i;
const CONTESTED_FRAMING_CUE_PATTERN =
  /(?:people\s+(?:nowadays\s+)?(?:get|define)\s+[^.?!]{0,60}\s+wrong|it(?:['’]s| is)\s+nonsense\s+to\s+think|\breally\b|\bactually\b|because\s+it\s+was\s+in\s+the\s+name|\bin\s+the\s+name\b|\bbasically\s+the\s+same\b|\bmean\s+the\s+opposite\b|\bmeans\s+the\s+opposite\b|\bwrong\s+now\b)/i;
const COHERENT_CRITIQUE_LEAD_PATTERN =
  /\b(is a failure|is broken|is a mess|is failing(?:\s+people|\s+kids)?|is failing people|is failing kids|is a disaster|is a scam|are a scam|is a waste of money|are a waste of money|is declining|are declining|is hurting|are hurting)\b/i;
const BROAD_CRITIQUE_SUBJECT_PATTERN =
  /\b(healthcare system|justice system|school system|public schools|schools|college|climate(?: change)? policies|healthcare|product|app|city|housing|transit)\b/i;
const CRITIQUE_OUTCOME_CUE_PATTERN =
  /\b(can['’]?t|cannot|keeps|rising|rises|confusing|unclear|slow|unaffordable|unreliable|worse|delayed|fails?|failing|weaker|less|not working|support|billing|onboarding|housing|transit|crime|notifications|layout|export|discipline|parents|doctor|doctors|cost|subsid(?:y|ies)|hurt|businesses|debt|outdated|degree|consequences|crushed|outcomes|lawyers|truth|avoid)\b/i;
const ARGUMENT_LOADED_STATEMENT_PATTERN =
  /\b(is just|are just|there(?:['’]s| is) nothing|nothing intelligent|anyone saying otherwise|doesn['’]?t understand|don't understand|hyping it|waste of money)\b/i;
const HEDGED_STANCE_PATTERN =
  /\b(i think|i don['’]?t think|i do not trust|i don['’]?t trust|to me|for me|in my experience)\b/i;
const STANCE_BASIS_PATTERN =
  /\b(because|since|after|when|for example|for instance|due to|based on|what happened|the reason|from what)\b/i;
const PERSONAL_SCOPE_PATTERN =
  /\b(i['’]?ve (?:ever )?(?:been to|had|seen|played|used)|in my experience|for me|to me|from what i saw|i['’]?ve ever|i['’]?ve had|i['’]?ve seen|i['’]?ve played|i['’]?ve used)\b/i;
const VAGUE_CONCERN_PATTERN =
  /^(this feels off|something is wrong here|something feels wrong|this is weird|that seems wrong|this does not seem right|this doesn't seem right|i do not like this|i don't like this|i am not sure about this|i'm not sure about this)\b[.!?]*$/i;
const NON_ACTIONABLE_REMARK_PATTERN =
  /^(?:ew|wow,? that is gross|that was rude|(?:he|she|they|that guy|this guy|that girl|this girl|that person|this person)\s+(?:is|looks|has)\s+(?:ugly|gross|disgusting|huge boobs?))\b[.!?]*$/i;
const BOUNDED_DECLARATIVE_STATEMENT_PATTERN =
  /^(?!(?:this feels|this seems|that seems|this is weird|something\b|i am\b|i['’]m\b))(?:[a-z][a-z'’:-]*)(?:\s+[a-z][a-z'’:-]*){0,3}\s+(?:is|are|was|were)\s+(?:an?\s+|the\s+)?[a-z][a-z'’:-]*(?:\s+[a-z][a-z'’:-]*){0,3}[.!?]*$/i;
const QUESTION_AS_CONSTRAINT_PATTERN =
  /^(should i|should we|should this|can i|can we|could i|could we|would i|would we|do i|do we|is this)\b/i;
const INCOMPLETE_FRAGMENT_PATTERN = /^[a-z0-9']+(\s+[a-z0-9']+)?[!.?]*$/i;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function extractQuotedMaterials(input: string): string[] {
  const matches = Array.from(input.matchAll(/"([^"]{12,})"/g));
  return matches.map((match) => match[1].trim()).slice(0, 3);
}

function extractConstraints(input: string): string[] {
  const segments = input
    .split(/\n|[.;]/)
    .flatMap((part) => part.split(/,(?!\d)|\band\b/i))
    .map((part) => part.trim())
    .filter(Boolean);

  const constraints = segments.filter(
    (segment) => CONSTRAINT_PATTERN.test(segment) && !QUESTION_AS_CONSTRAINT_PATTERN.test(segment)
  );
  return Array.from(new Set(constraints)).slice(0, 6);
}

function classifyUtteranceType(normalized: string, materials: string[]): UtteranceType {
  const violenceRisk =
    VIOLENCE_RISK_PATTERN.test(normalized) && VIOLENCE_SUPPORT_PATTERN.test(normalized);
  const proofRequest =
    EXPLICIT_PROOF_PATTERN.test(normalized) ||
    CHAT_PATTERN.test(normalized) ||
    MATERIAL_REFERENCE_PATTERN.test(normalized) ||
    materials.length > 0;
  const decisionRequest =
    VAGUE_PRIORITY_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    /\b(should i|should we|recommend|pick|choose|prioriti[sz]e|build first|ship first|now or later)\b/i.test(normalized);
  const factualRequest =
    WORLD_PATTERN.test(normalized) ||
    /^(what|when|where|who|how many|how much|which)\b/i.test(normalized);

  if (violenceRisk) {
    return "safety_sensitive_statement";
  }
  if (GREETING_PATTERN.test(normalized)) {
    return "greeting";
  }
  if (EMOTIONAL_REACTION_PATTERN.test(normalized)) {
    return "emotional_reaction";
  }
  if (OPINION_STATEMENT_PATTERN.test(normalized)) {
    return "opinion_statement";
  }
  if (OBSERVATION_PATTERN.test(normalized) && !normalized.endsWith("?")) {
    return "observation";
  }
  if (proofRequest) {
    return "proof_request";
  }
  if (decisionRequest) {
    return "decision_request";
  }
  if (factualRequest) {
    return "factual_request";
  }
  if (INCOMPLETE_FRAGMENT_PATTERN.test(normalized)) {
    return "incomplete_fragment";
  }

  return "other";
}

function buildSignals(
  normalized: string,
  materials: string[],
  utteranceType: UtteranceType
): RequestSignals {
  const shortPrompt = normalized.split(/\s+/).length <= 4;
  const broad = BROAD_PATTERNS.some((pattern) => pattern.test(normalized));
  const multiPart =
    (normalized.match(/\band\b/gi)?.length ?? 0) >= 2 ||
    (normalized.match(/,/g)?.length ?? 0) >= 2;
  const multiAssertion =
    multiPart || normalized.split(/[.!?]+/).filter((part) => part.trim().length > 0).length >= 2;
  const citesChatContext = CHAT_PATTERN.test(normalized);
  const stackDecisionWithoutCriteria =
    /\b(pick a stack|which stack|best stack|stack fits best)\b/i.test(normalized) &&
    !citesChatContext &&
    !/\b(database|auth|typescript|node|react|budget|team|constraint|requirements|above|offline|simple)\b/i.test(normalized);
  const choiceWithoutCriteria =
    /\b(choose|pick|recommend|recommendation|should i|should we|monthly or annual|react or plain html|react or svelte|html or react|email or qr|json or sqlite|sqlite or files|which .* fits best)\b/i.test(normalized) &&
    /\b(or|vs|versus)\b/i.test(normalized) &&
    !/\b(because|given|under |within |budget|audience|team|speed|cost|complexity|scope|constraint|constraints|requirements|above|earlier|for myself|for one classroom|one admin|one page)\b/i.test(normalized);
  const compareWithoutCriteria =
    /\b(compare|versus|vs)\b/i.test(normalized) &&
    !citesChatContext &&
    !/\b(speed|cost|complexity|bundle|performance|maintainability|learning|team|criteria|using what we've already decided|using only what we've already decided|using only the constraints we've already nailed down)\b/i.test(normalized);
  const priorityDecisionWithoutContext =
    VAGUE_PRIORITY_PATTERNS.some((pattern) => pattern.test(normalized)) && !citesChatContext;
  const answerableSubjectiveQuestion =
    ANSWERABLE_SUBJECTIVE_PATTERN.test(normalized) && !SUBJECTIVE_SAFETY_PATTERN.test(normalized);
  const directQuestionReady =
    DIRECT_QUESTION_START_PATTERN.test(normalized) &&
    normalized.split(/\s+/).length <= 16 &&
    !multiAssertion &&
    !CONTESTED_FRAMING_DOMAIN_PATTERN.test(normalized) &&
    !STRONG_UNSUPPORTED_STANCE_PATTERN.test(normalized) &&
    !COHERENT_CRITIQUE_LEAD_PATTERN.test(normalized);
  const violenceRisk =
    VIOLENCE_RISK_PATTERN.test(normalized) && VIOLENCE_SUPPORT_PATTERN.test(normalized);
  const personallyScopedEvaluation = PERSONAL_SCOPE_PATTERN.test(normalized);
  const vagueConcernReaction =
    VAGUE_CONCERN_PATTERN.test(normalized) &&
    !personallyScopedEvaluation &&
    !violenceRisk;
  const nonActionableRemark =
    !normalized.endsWith("?") &&
    NON_ACTIONABLE_REMARK_PATTERN.test(normalized) &&
    !vagueConcernReaction &&
    !violenceRisk;
  const contestedFramingClaim =
    !normalized.endsWith("?") &&
    CONTESTED_FRAMING_DOMAIN_PATTERN.test(normalized) &&
    CONTESTED_FRAMING_CUE_PATTERN.test(normalized) &&
    !HEDGED_STANCE_PATTERN.test(normalized) &&
    !personallyScopedEvaluation &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !answerableSubjectiveQuestion &&
    !violenceRisk &&
    !EMOTIONAL_REACTION_PATTERN.test(normalized) &&
    (multiAssertion || /\b(left(?:-wing)?|right(?:-wing)?|socialis[tm]|communis[tm]|fascis[tm]|nazi(?:s)?)\b/i.test(normalized));
  const broadCritiqueLead =
    COHERENT_CRITIQUE_LEAD_PATTERN.test(normalized) &&
    BROAD_CRITIQUE_SUBJECT_PATTERN.test(normalized);
  const coherentCritiqueBundle =
    !normalized.endsWith("?") &&
    ((multiAssertion &&
      COHERENT_CRITIQUE_LEAD_PATTERN.test(normalized) &&
      CRITIQUE_OUTCOME_CUE_PATTERN.test(normalized)) ||
      broadCritiqueLead) &&
    !HEDGED_STANCE_PATTERN.test(normalized) &&
    !personallyScopedEvaluation &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !contestedFramingClaim &&
    !violenceRisk;
  const argumentLoadedStatement =
    !normalized.endsWith("?") &&
    multiAssertion &&
    ARGUMENT_LOADED_STATEMENT_PATTERN.test(normalized) &&
    !directQuestionReady &&
    !personallyScopedEvaluation &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !contestedFramingClaim &&
    !coherentCritiqueBundle &&
    !violenceRisk;
  const strongUnsupportedStance =
    !normalized.endsWith("?") &&
    (STRONG_UNSUPPORTED_STANCE_PATTERN.test(normalized) ||
      BROAD_TRAIT_REALITY_CLAIM_PATTERN.test(normalized)) &&
    !STANCE_BASIS_PATTERN.test(normalized) &&
    !HEDGED_STANCE_PATTERN.test(normalized) &&
    !personallyScopedEvaluation &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !contestedFramingClaim &&
    !coherentCritiqueBundle &&
    !argumentLoadedStatement &&
    !answerableSubjectiveQuestion &&
    !violenceRisk &&
    !EMOTIONAL_REACTION_PATTERN.test(normalized);
  const boundedDeclarativeStatement =
    !normalized.endsWith("?") &&
    BOUNDED_DECLARATIVE_STATEMENT_PATTERN.test(normalized) &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !contestedFramingClaim &&
    !coherentCritiqueBundle &&
    !argumentLoadedStatement &&
    !strongUnsupportedStance &&
    !violenceRisk;
  const utteranceDirectReady = [
    "greeting",
    "observation",
    "emotional_reaction",
    "opinion_statement"
  ].includes(utteranceType) || boundedDeclarativeStatement;
  const documentProvided = materials.length > 0;
  const refersToMissingSourceText =
    /\b(rewrite|summarize|edit|review|analyze)\s+this\b/i.test(normalized) ||
    /\bmake this sound\b/i.test(normalized) ||
    /\bless stiff\b/i.test(normalized) ||
    /\bless formal\b/i.test(normalized) ||
    /\bless robotic\b/i.test(normalized) ||
    /\bless corporate\b/i.test(normalized);
  const materialReferencedButMissing =
    (MATERIAL_REFERENCE_PATTERN.test(normalized) || refersToMissingSourceText) &&
    !documentProvided &&
    !citesChatContext;
  const worldFactSensitive =
    !utteranceDirectReady &&
    !vagueConcernReaction &&
    !nonActionableRemark &&
    !contestedFramingClaim &&
    !coherentCritiqueBundle &&
    !argumentLoadedStatement &&
    !strongUnsupportedStance &&
    (WORLD_PATTERN.test(normalized) ||
      /\b(current|latest|lts)\b.*\bversion\b/i.test(normalized) ||
      /\bversion\b.*\b(current|latest|lts)\b/i.test(normalized));
  const scopeConflict =
    /\bunder\s+\d+\s+words\b.*\bevery detail\b/i.test(normalized) ||
    /\bbrief\b.*\bexhaustive\b/i.test(normalized) ||
    /\bdo not make any assumptions\b.*\bunspecified\b/i.test(normalized) ||
    /\bdatabase\b.*\bavoid all persistence\b/i.test(normalized) ||
    /\bchild\b.*\bcompliance attorney\b/i.test(normalized) ||
    /\bkid\b.*\bparent\b.*\bsame time\b/i.test(normalized) ||
    /\bparent\b.*\bkid\b.*\bsame time\b/i.test(normalized) ||
    /\btiny\b.*\bevery future use case\b/i.test(normalized) ||
    /\bpolished\b.*\bthis week\b/i.test(normalized) ||
    /\bpolished\b.*\bspend a week\b/i.test(normalized);

  const missingKeyVariable =
    (shortPrompt && !answerableSubjectiveQuestion && !directQuestionReady && !violenceRisk && !vagueConcernReaction && !nonActionableRemark && !contestedFramingClaim && !coherentCritiqueBundle && !argumentLoadedStatement && !strongUnsupportedStance && !utteranceDirectReady) ||
    vagueConcernReaction ||
    contestedFramingClaim ||
    coherentCritiqueBundle ||
    argumentLoadedStatement ||
    compareWithoutCriteria ||
    stackDecisionWithoutCriteria ||
    choiceWithoutCriteria ||
    priorityDecisionWithoutContext ||
    broad ||
    materialReferencedButMissing ||
    /\bbest architecture\b/i.test(normalized) ||
    /\bbest unspecified option\b/i.test(normalized) ||
    refersToMissingSourceText;

  return {
    broad,
    shortPrompt,
    multiPart,
    scopeConflict,
    missingKeyVariable,
    stackDecisionWithoutCriteria,
    choiceWithoutCriteria,
    priorityDecisionWithoutContext,
    answerableSubjectiveQuestion,
    directQuestionReady,
    violenceRisk,
    personallyScopedEvaluation,
    vagueConcernReaction,
    nonActionableRemark,
    contestedFramingClaim,
    coherentCritiqueBundle,
    argumentLoadedStatement,
    strongUnsupportedStance,
    utteranceDirectReady,
    documentProvided,
    materialReferencedButMissing,
    citesChatContext,
    worldFactSensitive,
    compareWithoutCriteria
  };
}

function buildAmbiguity(signals: RequestSignals): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.broad) {
    reasons.push("The ask is too broad for one clean answer.");
  }
  if (signals.compareWithoutCriteria) {
    reasons.push("The comparison is missing criteria.");
  }
  if (signals.priorityDecisionWithoutContext) {
    reasons.push("The priority decision is missing the feature or decision frame.");
  }
  if (signals.vagueConcernReaction) {
    reasons.push("The concern is too vague to engage well without one more detail.");
  }
  if (signals.nonActionableRemark) {
    reasons.push("The input is a non-actionable remark that can be handled directly.");
  }
  if (signals.contestedFramingClaim) {
    reasons.push("The statement combines contested framing claims without a shared definition.");
  }
  if (signals.coherentCritiqueBundle) {
    reasons.push("The critique is clear, but the next useful step is to define what should change.");
  }
  if (signals.argumentLoadedStatement) {
    reasons.push("The input is an argument-loaded statement, not a short direct-answer prompt.");
  }
  if (signals.strongUnsupportedStance) {
    reasons.push("The statement is a strong claim without saying what it rests on.");
  }
  if (signals.stackDecisionWithoutCriteria || signals.choiceWithoutCriteria) {
    reasons.push("The decision is missing its key variable.");
  }
  if (signals.materialReferencedButMissing) {
    reasons.push("The request references material that is not actually present.");
  }
  if (signals.scopeConflict) {
    reasons.push("The request contains conflicting constraints.");
  }
  if (
    signals.shortPrompt &&
    !signals.worldFactSensitive &&
    !signals.answerableSubjectiveQuestion &&
    !signals.directQuestionReady &&
    !signals.violenceRisk &&
    !signals.vagueConcernReaction &&
    !signals.nonActionableRemark &&
    !signals.contestedFramingClaim &&
    !signals.coherentCritiqueBundle &&
    !signals.argumentLoadedStatement &&
    !signals.strongUnsupportedStance &&
    !signals.utteranceDirectReady
  ) {
    reasons.push("The prompt is too short to anchor a specific answer.");
  }

  if (!reasons.length && signals.multiPart) {
    reasons.push("The request contains multiple tasks that may need ordering.");
  }

  return {
    score: reasons.length,
    reasons
  };
}

function buildProofNeed(
  normalized: string,
  signals: RequestSignals,
  constraints: string[],
  materials: string[]
): { required: boolean; suggestedType: ProofType; reasons: string[] } {
  const reasons: string[] = [];
  let suggestedType: ProofType = "none";

  if (signals.documentProvided) {
    suggestedType = "document";
    reasons.push("The answer stands on provided text.");
  } else if (signals.citesChatContext) {
    suggestedType = "chat";
    reasons.push("The answer depends on prior chat context or previously stated constraints.");
  } else if (signals.worldFactSensitive) {
    suggestedType = "world";
    reasons.push("The answer depends on outside facts that can change.");
  }

  const explicitProofRequest = EXPLICIT_PROOF_PATTERN.test(normalized);
  const documentQuestion = suggestedType === "document";
  const chatBoundQuestion = suggestedType === "chat";
  const worldBoundQuestion = suggestedType === "world";

  return {
    required: explicitProofRequest || documentQuestion || chatBoundQuestion || worldBoundQuestion,
    suggestedType,
    reasons
  };
}

function buildReadiness(signals: RequestSignals, ambiguityReasons: string[]): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.materialReferencedButMissing) {
    reasons.push("Referenced material is missing.");
  }
  if (signals.scopeConflict) {
    reasons.push("Constraints conflict.");
  }
  if (signals.compareWithoutCriteria) {
    reasons.push("Decision criteria are missing.");
  }
  if (signals.priorityDecisionWithoutContext) {
    reasons.push("The priority decision is missing the feature or decision context.");
  }
  if (signals.vagueConcernReaction) {
    reasons.push("The concern needs one more detail before it can be engaged well.");
  }
  if (signals.nonActionableRemark) {
    return { ready: true, reasons: [] };
  }
  if (signals.contestedFramingClaim) {
    reasons.push("The argument depends on definitions that have not been aligned yet.");
  }
  if (signals.coherentCritiqueBundle) {
    reasons.push("The critique is clear, but the change target is still missing.");
  }
  if (signals.argumentLoadedStatement) {
    reasons.push("The statement is not yet in a clear direct-answer shape.");
  }
  if (signals.strongUnsupportedStance) {
    reasons.push("The statement is too strong to engage well without its basis.");
  }
  if ((signals.stackDecisionWithoutCriteria || signals.choiceWithoutCriteria) && !signals.compareWithoutCriteria) {
    reasons.push("The key decision variable is missing.");
  }
  if (signals.broad) {
    reasons.push("The scope is too broad.");
  }
  if (signals.missingKeyVariable && reasons.length === 0) {
    reasons.push("A key decision variable is still missing.");
  }
  if (signals.shortPrompt && ambiguityReasons.length > 0) {
    reasons.push("The prompt is not specific enough yet.");
  }

  return {
    ready: reasons.length === 0,
    reasons
  };
}

export function interpretInput(rawInput: string): RequestAnalysis {
  const normalizedInput = normalizeWhitespace(rawInput);
  const materials = extractQuotedMaterials(rawInput);
  const utteranceType = classifyUtteranceType(normalizedInput, materials);
  const constraints = extractConstraints(rawInput);
  const signals = buildSignals(normalizedInput, materials, utteranceType);
  const domainAnchor = detectDomainAnchor(normalizedInput);
  const ambiguity = buildAmbiguity(signals);
  const proofNeed = buildProofNeed(normalizedInput, signals, constraints, materials);
  const readiness = buildReadiness(signals, ambiguity.reasons);

  return {
    rawInput,
    normalizedInput,
    userAsk: normalizedInput,
    utteranceType,
    constraints,
    ambiguity,
    proofNeed,
    readiness,
    signals,
    materials,
    domainAnchor
  };
}
