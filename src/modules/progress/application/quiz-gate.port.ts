export const QUIZ_GATE_PORT = Symbol('QUIZ_GATE_PORT');

export interface QuizGatePort {
  hasQuizForLab(labId: string): Promise<boolean>;
  hasPassingAttempt(userId: string, labId: string): Promise<boolean>;
}
