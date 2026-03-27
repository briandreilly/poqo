export type Move = "DIRECT" | "NARROW" | "PROVE";

export type ProofType = "none" | "chat" | "document" | "world";

export type ProfileId = "default" | "founder" | "kidsafe";

export type PromptSetMode = "v1" | "stress" | "blind" | "redteam" | "variance" | "all";

export type BenchmarkId = Exclude<PromptSetMode, "all">;

export type HarnessMode = "poqo-only" | "poqo-plus-model";

export type ModelProvider = "openai";

export type InterventionMode = "calm" | "counter" | "blunt";

export type ResponseAttitude = "balanced" | "challenging";

export type LegacyResponseAttitude = "normal" | "challenge" | "difficult";

export type ResponseTone = "neutral" | "direct";

export type LegacyResponseTone = "warm" | "sharp";

export type ResponseLanguage = "en" | "es";

export type ResponseLength = "reaction" | "short" | "medium" | "long";

export type DomainAnchor = "minecraft" | "product-ui" | "healthcare" | null;

export type ToneHint = "plain" | "concise" | "inspectable" | "practical" | "low-drama" | "gentle" | "age-clear";

export type UtteranceType =
  | "greeting"
  | "observation"
  | "emotional_reaction"
  | "opinion_statement"
  | "factual_request"
  | "decision_request"
  | "proof_request"
  | "incomplete_fragment"
  | "safety_sensitive_statement"
  | "other";

export interface ConstitutionCore {
  identity: {
    role: string;
  };
  purpose: {
    mission: string;
  };
  defaultBehavior: string[];
  forbiddenBehavior: string[];
  humanOverride: string;
}

export interface ProfileResponseLabels {
  direct: string;
  narrow: string;
  prove: string;
}

export interface TermSubstitution {
  from: string;
  to: string;
}

export interface Profile {
  id: ProfileId;
  title: string;
  toneHints: ToneHint[];
  responseLabels: ProfileResponseLabels;
  termSubstitutions?: TermSubstitution[];
}

export interface PromptGuide {
  role: string;
  mission: string;
  toneHints: ToneHint[];
  defaultBehavior: string[];
  forbiddenBehavior: string[];
  humanOverride: string;
}

export interface RuntimeGuide {
  profile: Profile;
  promptGuide: PromptGuide;
}

export interface ModelConfig {
  provider: ModelProvider;
  apiKey: string | null;
  name: string;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

export interface ResponseConfig {
  attitude: ResponseAttitude;
  tone: ResponseTone;
  language: ResponseLanguage;
  customToneNotes: string;
  customBehaviorNotes: string;
  forbid: string[];
  prefer: string[];
}

export interface ResponseConfigInput {
  attitude?: ResponseAttitude | LegacyResponseAttitude;
  tone?: ResponseTone | LegacyResponseTone;
  language?: ResponseLanguage;
  customToneNotes?: string;
  customBehaviorNotes?: string;
  forbid?: string[];
  prefer?: string[];
}

export type ResponseSurface = "default" | "live-brief";

export interface ModelExecutionInput {
  prompt: string;
  runtimeGuide: RuntimeGuide;
  move: Move;
  proofType: ProofType;
  routingExplanation: string;
  poqoBrief: string;
  framePreservingDirect: boolean;
  interventionMode: InterventionMode;
  responseConfig: ResponseConfig;
  domainAnchor: DomainAnchor;
  responseSurface?: ResponseSurface;
  responseLength?: ResponseLength;
}

export interface ModelExecutionPrompt {
  instructionText: string;
  taskText: string;
}

export interface ModelExecutionResult {
  provider: ModelProvider;
  modelName: string;
  responseText: string;
}

export interface BenchmarkMetadata {
  id: BenchmarkId;
  name: string;
  filePath: string;
  frozen: boolean;
  description: string;
  reportPath: string;
  profiles: ProfileId[];
}

export interface AmbiguityAssessment {
  score: number;
  reasons: string[];
}

export interface ProofNeedAssessment {
  required: boolean;
  suggestedType: ProofType;
  reasons: string[];
}

export interface ReadinessAssessment {
  ready: boolean;
  reasons: string[];
}

export interface RequestSignals {
  broad: boolean;
  shortPrompt: boolean;
  multiPart: boolean;
  scopeConflict: boolean;
  missingKeyVariable: boolean;
  stackDecisionWithoutCriteria: boolean;
  choiceWithoutCriteria: boolean;
  priorityDecisionWithoutContext: boolean;
  answerableSubjectiveQuestion: boolean;
  directQuestionReady: boolean;
  violenceRisk: boolean;
  personallyScopedEvaluation: boolean;
  vagueConcernReaction: boolean;
  nonActionableRemark: boolean;
  contestedFramingClaim: boolean;
  coherentCritiqueBundle: boolean;
  argumentLoadedStatement: boolean;
  strongUnsupportedStance: boolean;
  utteranceDirectReady: boolean;
  documentProvided: boolean;
  materialReferencedButMissing: boolean;
  citesChatContext: boolean;
  worldFactSensitive: boolean;
  compareWithoutCriteria: boolean;
}

export interface RequestAnalysis {
  rawInput: string;
  normalizedInput: string;
  userAsk: string;
  utteranceType: UtteranceType;
  constraints: string[];
  ambiguity: AmbiguityAssessment;
  proofNeed: ProofNeedAssessment;
  readiness: ReadinessAssessment;
  signals: RequestSignals;
  materials: string[];
  domainAnchor: DomainAnchor;
}

export interface RoutingDecision {
  move: Move;
  reason: string;
  explanation: string;
}

export interface ProofSelection {
  type: ProofType;
  reason: string;
  basis: string[];
}

export interface PoqoResult {
  profileId: ProfileId;
  move: Move;
  proofType: ProofType;
  routingExplanation: string;
  finalResponse: string;
  analysis: RequestAnalysis;
  proof: ProofSelection;
}

export interface PromptCase {
  id: string;
  category: string;
  profileId?: ProfileId;
  profilesToRun?: ProfileId[];
  prompt: string;
  expectedMove: Move;
  expectedProof: ProofType;
  why: string;
  notes: string;
}

export interface PromptSetFile {
  version: string;
  prompts: PromptCase[];
}

export interface ResponseQualityAssessment {
  forwardMotion: boolean;
  stalled: boolean;
  overNarrowed: boolean;
  overProved: boolean;
  notes: string[];
}

export interface EvaluationResult {
  promptCase: PromptCase;
  profileId?: ProfileId;
  actualMove: Move;
  actualProof: ProofType;
  moveMatch: boolean;
  proofMatch: boolean;
  routingExplanation: string;
  quality: ResponseQualityAssessment;
  profileDrift?: boolean;
  driftReason?: string;
}

export interface EvaluationSummary {
  promptTotal: number;
  totalRuns: number;
  moveMatches: number;
  proofMatches: number;
  moveAccuracy: number;
  proofAccuracy: number;
  forwardMotionPasses: number;
  stalls: number;
  overNarrowCases: number;
  overProofCases: number;
  profileDriftCases: number;
}

export interface EvaluationReport {
  label: BenchmarkId;
  benchmarkId: BenchmarkId;
  benchmarkName: string;
  benchmarkFilePath: string;
  frozen: boolean;
  summary: EvaluationSummary;
  results: EvaluationResult[];
}

export interface CombinedEvaluationReport {
  label: "all";
  reports: EvaluationReport[];
  summary: EvaluationSummary;
}

export interface HarnessRequest {
  profileId: ProfileId;
  prompt: string;
  mode: HarnessMode;
  interventionMode?: InterventionMode;
  responseConfig?: ResponseConfigInput;
  domainContextAnchor?: DomainAnchor | null;
}

export interface HarnessStatus {
  modelAvailable: boolean;
  modelProvider: ModelProvider;
  modelName: string;
}

export interface HarnessResponse {
  profile: ProfileId;
  prompt: string;
  mode: HarnessMode;
  interventionMode: InterventionMode;
  responseConfig: ResponseConfig;
  effectiveDomainAnchor: DomainAnchor;
  move: Move;
  proofType: ProofType;
  routingExplanation: string;
  poqoBrief: string;
  modelResponse: string | null;
  modelProvider: ModelProvider;
  modelName: string;
  modelAvailable: boolean;
  modelError?: string;
  poqoCompletedBeforeModel: boolean;
  poqoStartedAt: string;
  poqoFinishedAt: string;
  modelStartedAt: string | null;
  modelFinishedAt: string | null;
}
