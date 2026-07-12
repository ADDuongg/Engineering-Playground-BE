import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { CreateLabGuidedStepUseCase } from './create-lab-guided-step.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';

describe('CreateLabGuidedStepUseCase', () => {
  let useCase: CreateLabGuidedStepUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let stepRepository: jest.Mocked<LabGuidedStepRepository>;

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    stepRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<LabGuidedStepRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLabGuidedStepUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: LabGuidedStepRepository, useValue: stepRepository },
      ],
    }).compile();

    useCase = module.get(CreateLabGuidedStepUseCase);
  });

  it('creates a guided step', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    stepRepository.create.mockResolvedValue({
      id: 'step-1',
      displayOrder: 1,
      title: 'Run',
      instruction: 'Do it',
      action: 'run_sql',
      payload: null,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      updatedAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await useCase.execute('demo-lab', {
      title: 'Run',
      instruction: 'Do it',
      action: 'run_sql',
      displayOrder: 1,
    });

    expect(result.id).toBe('step-1');
    expect(result.labSlug).toBe('demo-lab');
    expect(result.action).toBe('run_sql');
  });

  it('rejects unknown action', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);

    await expect(
      useCase.execute('demo-lab', {
        title: 'Bad',
        instruction: 'x',
        action: 'not_a_real_action' as never,
        displayOrder: 1,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('throws NOT_FOUND when lab missing', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', {
        title: 'Run',
        instruction: 'Do it',
        action: 'run_sql',
        displayOrder: 1,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
