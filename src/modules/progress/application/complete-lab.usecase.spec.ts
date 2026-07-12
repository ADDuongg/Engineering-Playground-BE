import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, LabStatus, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { CompleteLabUseCase } from './complete-lab.usecase';
import { LabRepository } from '../infrastructure/lab.repository';
import { RecordLabCompletionService } from './record-lab-completion.service';
import { QUIZ_GATE_PORT, QuizGatePort } from './quiz-gate.port';

describe('CompleteLabUseCase', () => {
  let useCase: CompleteLabUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let recordLabCompletionService: jest.Mocked<RecordLabCompletionService>;
  let quizGate: jest.Mocked<QuizGatePort>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    title: 'Index Playground',
    description: null,
    trackId: 'track-1',
    sequenceOrder: 1,
    status: LabStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    completions: [],
    track: {
      id: 'track-1',
      slug: 'database-sql',
      status: TrackStatus.ACTIVE,
    },
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
      findOrderedByTrackId: jest.fn(),
      findOrderedByTrackSlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;

    recordLabCompletionService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<RecordLabCompletionService>;

    quizGate = {
      hasQuizForLab: jest.fn(),
      hasPassingAttempt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteLabUseCase,
        { provide: LabRepository, useValue: labRepository },
        {
          provide: RecordLabCompletionService,
          useValue: recordLabCompletionService,
        },
        { provide: QUIZ_GATE_PORT, useValue: quizGate },
      ],
    }).compile();

    useCase = module.get(CompleteLabUseCase);
  });

  it('completes a lab when no quiz gate blocks', async () => {
    const completedAt = '2026-07-09T10:00:00.000Z';
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizGate.hasQuizForLab.mockResolvedValue(false);
    recordLabCompletionService.record.mockResolvedValue({
      labSlug: 'index-playground',
      trackSlug: 'database-sql',
      completedAt,
      alreadyCompleted: false,
    });

    const result = await useCase.execute('user-1', 'index-playground');

    expect(result).toEqual({
      labSlug: 'index-playground',
      trackSlug: 'database-sql',
      completedAt,
      alreadyCompleted: false,
    });
    expect(recordLabCompletionService.record).toHaveBeenCalledWith(
      'user-1',
      activeLab,
    );
  });

  it('rejects self-complete when quiz exists and not passed', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizGate.hasQuizForLab.mockResolvedValue(true);
    quizGate.hasPassingAttempt.mockResolvedValue(false);

    await expect(
      useCase.execute('user-1', 'index-playground'),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(recordLabCompletionService.record).not.toHaveBeenCalled();
  });

  it('allows self-complete after passing quiz', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizGate.hasQuizForLab.mockResolvedValue(true);
    quizGate.hasPassingAttempt.mockResolvedValue(true);
    recordLabCompletionService.record.mockResolvedValue({
      labSlug: 'index-playground',
      trackSlug: 'database-sql',
      completedAt: '2026-07-09T10:00:00.000Z',
      alreadyCompleted: false,
    });

    const result = await useCase.execute('user-1', 'index-playground');

    expect(result.alreadyCompleted).toBe(false);
    expect(recordLabCompletionService.record).toHaveBeenCalled();
  });

  it('is idempotent via record service', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizGate.hasQuizForLab.mockResolvedValue(false);
    recordLabCompletionService.record.mockResolvedValue({
      labSlug: 'index-playground',
      trackSlug: 'database-sql',
      completedAt: '2026-07-09T09:00:00.000Z',
      alreadyCompleted: true,
    });

    const result = await useCase.execute('user-1', 'index-playground');

    expect(result.alreadyCompleted).toBe(true);
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('throws FORBIDDEN when track is coming-soon', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      track: {
        ...activeLab.track,
        status: TrackStatus.COMING_SOON,
      },
    } as never);

    await expect(
      useCase.execute('user-1', 'index-playground'),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      useCase.execute('user-1', 'index-playground'),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('throws FORBIDDEN when lab is coming-soon', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      status: LabStatus.COMING_SOON,
    } as never);

    await expect(
      useCase.execute('user-1', 'index-playground'),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});
