import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { ReorderLabGuidedStepsUseCase } from './reorder-lab-guided-steps.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';

describe('ReorderLabGuidedStepsUseCase', () => {
  let useCase: ReorderLabGuidedStepsUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let stepRepository: jest.Mocked<LabGuidedStepRepository>;

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    stepRepository = {
      findOrderedByLabId: jest.fn(),
      reorder: jest.fn(),
    } as unknown as jest.Mocked<LabGuidedStepRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReorderLabGuidedStepsUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: LabGuidedStepRepository, useValue: stepRepository },
      ],
    }).compile();

    useCase = module.get(ReorderLabGuidedStepsUseCase);
  });

  it('reorders when stepIds match exactly', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    stepRepository.findOrderedByLabId.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ] as never);
    stepRepository.reorder.mockResolvedValue([
      {
        id: 'b',
        displayOrder: 1,
        title: 'B',
        instruction: 'b',
        action: 'run_sql',
        payload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'a',
        displayOrder: 2,
        title: 'A',
        instruction: 'a',
        action: 'take_quiz',
        payload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const result = await useCase.execute('demo-lab', { stepIds: ['b', 'a'] });
    expect(stepRepository.reorder).toHaveBeenCalledWith('lab-1', ['b', 'a']);
    expect(result.steps.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('rejects incomplete reorder set', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    stepRepository.findOrderedByLabId.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ] as never);

    await expect(
      useCase.execute('demo-lab', { stepIds: ['a'] }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(stepRepository.reorder).not.toHaveBeenCalled();
  });
});
