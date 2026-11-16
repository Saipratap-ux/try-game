export type GameCategory =
  | 'kids'
  | 'brain'
  | 'racing'
  | 'arcade'
  | 'sports'
  | 'family';

export type AgeGroupId =
  | '1-3'
  | '4-6'
  | '7-12'
  | '13-17'
  | '18-30'
  | '31-45'
  | '46-60+';

export type AppPage =
  | 'home'
  | 'all-games'
  | 'kids'
  | 'brain'
  | 'racing'
  | 'arcade'
  | 'sports'
  | 'family'
  | 'multiplayer'
  | 'offline'
  | 'my-games'
  | 'profile'
  | 'admin'
  | 'help';

export interface AgeGroupInfo {
  id: AgeGroupId;
  label: string;
  experience: string;
  requiresSupervision?: boolean;
}

export interface GameMetadata {
  id: string;
  title: string;
  category: GameCategory;
  shortDesc: string;
  instructions: string;
  ageGroups: AgeGroupId[];
  minAgeLabel: string;
  offlineCompatible: boolean;
  supportsMultiplayer: boolean;
  controls: ('touch' | 'keyboard' | 'mouse')[];
  estimatedMinutes: number;
  accentHex: string;
  enabled: boolean;
  featured?: boolean;
  popular?: boolean;
  version: string;
}

export interface GameProgress {
  gameId: string;
  highScore: number;
  plays: number;
  lastPlayedAt: string;
  bestRank?: string;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  source: string;
  gameId?: string;
  message: string;
  stack?: string;
  line?: number;
  status: 'open' | 'diagnosed' | 'resolved' | 'rolled-back';
  aiDiagnosis?: AIDiagnosisResult;
}

export interface AIDiagnosisResult {
  probableCause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedFix: string;
  safeAutoRepairAction: string | null;
  requiresAdminApproval: boolean;
  verificationSteps: string[];
  analyzedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  gameId: string;
  playerName: string;
  score: number;
  createdAt: string;
}

export interface PlayerProfile {
  name: string;
  preferredAgeGroup: AgeGroupId | 'all';
  soundEnabled: boolean;
  parentLockKidsSafe: boolean;
  theme: 'dark' | 'light';
  achievements: string[];
}
