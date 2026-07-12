import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ErrorCode,
  LabStatus,
  QUIZ_COMPLETED_EVENT,
  TrackStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { RecordLabCompletionService } from '../../progress/application/record-lab-completion.service';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { QuizAttemptRepository } from '../infrastructure/quiz-attempt.repository';
import { SubmitQuizUseCase } from './submit-quiz.usecase';

describe('SubmitQuizUseCase', () => {
  let useCase: SubmitQuizUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;
  let quizAttemptRepository: jest.Mocked<QuizAttemptRepository>;
  let recordLabCompletionService: jest.Mocked<RecordLabCompletionService>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    status: LabStatus.ACTIVE,
    track: { id: 'track-1', slug: 'database-sql', status: TrackStatus.ACTIVE },
  };

  const quizEntity = {
    id: 'quiz-1',
    labId: 'lab-1',
    title: 'Quiz',
    lab: activeLab,
    questions: [
      {
        id: 'q1',
        prompt: 'Q1?',
        questionType: 'single_select',
        sequenceOrder: 1,
        options: [
          { id: 'o1-correct', label: 'A', sequenceOrder: 1, isCorrect: true },
          { id: 'o1-wrong', label: 'B', sequenceOrder: 2, isCorrect: false },
        ],
      },
      {
        id: 'q2',
        prompt: 'Q2?',
        questionType: 'single_select',
        sequenceOrder: 2,
        options: [
          { id: 'o2-correct', label: 'C', sequenceOrder: 1, isCorrect: true },
          { id: 'o2-wrong', label: 'D', sequenceOrder: 2, isCorrect: false },
        ],
      },
    ],
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    quizRepository = {
      findByLabSlug: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;
    quizAttemptRepository = {
      insert: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<QuizAttemptRepository>;
    recordLabCompletionService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<RecordLabCompletionService>;
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitQuizUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: QuizRepository, useValue: quizRepository },
        { provide: QuizAttemptRepository, useValue: quizAttemptRepository },
        {
          provide: RecordLabCompletionService,
          useValue: recordLabCompletionService,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    useCase = module.get(SubmitQuizUseCase);
  });

  it('passes at 100%, emits quiz.completed, and records lab completion', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(quizEntity as never);
    recordLabCompletionService.record.mockResolvedValue({
      labSlug: 'index-playground',
      trackSlug: 'database-sql',
      completedAt: '2026-07-09T10:00:00.000Z',
      alreadyCompleted: false,
    });

    const result = await useCase.execute('user-1', 'index-playground', [
      { questionId: 'q1', optionId: 'o1-correct' },
      { questionId: 'q2', optionId: 'o2-correct' },
    ]);

    expect(result.passed).toBe(true);
    expect(result.percentCorrect).toBe(100);
    expect(result.labCompleted).toBe(true);
    expect(result.alreadyLabCompleted).toBe(false);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      QUIZ_COMPLETED_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        labSlug: 'index-playground',
        passed: true,
      }),
    );
    expect(recordLabCompletionService.record).toHaveBeenCalled();
  });

  it('fails when any answer is wrong and does not complete lab', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(quizEntity as never);

    const result = await useCase.execute('user-1', 'index-playground', [
      { questionId: 'q1', optionId: 'o1-correct' },
      { questionId: 'q2', optionId: 'o2-wrong' },
    ]);

    expect(result.passed).toBe(false);
    expect(result.percentCorrect).toBe(50);
    expect(result.incorrectQuestionIds).toEqual(['q2']);
    expect(result.labCompleted).toBe(false);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(recordLabCompletionService.record).not.toHaveBeenCalled();
    expect(quizAttemptRepository.insert).toHaveBeenCalled();
  });

  it('rejects incomplete submissions', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(quizEntity as never);

    await expect(
      useCase.execute('user-1', 'index-playground', [
        { questionId: 'q1', optionId: 'o1-correct' },
      ]),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('throws NOT_FOUND when quiz missing', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'index-playground', []),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
