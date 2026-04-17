export enum Phase {
  INPUT = 'INPUT',
  DRAFT_FEEDBACK = 'DRAFT_FEEDBACK',
  FINAL = 'FINAL'
}

export interface AppState {
  currentPhase: Phase;
  subject: string;
  targetLength: string;
  materials: string;
  observation: string;
  followUp: string;
  draft: string;
  finalRecord: string;
}
