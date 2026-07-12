import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { CreateLabQuizUseCase } from './create-lab-quiz.usecase';
import { DeleteLabQuizUseCase } from './delete-lab-quiz.usecase';
import { GetAdminLabQuizUseCase } from './get-admin-lab-quiz.usecase';
import { UpdateLabQuizUseCase } from './update-lab-quiz.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';

describe('Lab quiz shell use cases', () => {
  let createUseCase: CreateLabQuizUseCase;
  let updateUseCase: UpdateLabQuizUseCase;
  let getUseCase: GetAdminLabQuizUseCase;
  let deleteUseCase: DeleteLabQuizUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;

  const lab = { id: 'lab-1', slug: 'demo-lab' };
  const quiz = {
    id: 'quiz-1',
    labId: 'lab-1',
    title: 'Title',
    questions: [],
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    quizRepository = {
      existsByLabId: jest.fn(),
      create: jest.fn(),
      findAdminByLabId: jest.fn(),
      findByLabId: jest.fn(),
      updateTitle: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLabQuizUseCase,
        UpdateLabQuizUseCase,
        GetAdminLabQuizUseCase,
        DeleteLabQuizUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: QuizRepository, useValue: quizRepository },
      ],
    }).compile();

    createUseCase = module.get(CreateLabQuizUseCase);
    updateUseCase = module.get(UpdateLabQuizUseCase);
    getUseCase = module.get(GetAdminLabQuizUseCase);
    deleteUseCase = module.get(DeleteLabQuizUseCase);
  });

  it('creates a quiz shell', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    quizRepository.existsByLabId.mockResolvedValue(false);
    quizRepository.create.mockResolvedValue(quiz as never);

    const result = await createUseCase.execute('demo-lab', { title: 'Title' });
    expect(result.id).toBe('quiz-1');
    expect(result.labSlug).toBe('demo-lab');
    expect(result.questions).toEqual([]);
  });

  it('rejects duplicate quiz create', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    quizRepository.existsByLabId.mockResolvedValue(true);

    await expect(
      createUseCase.execute('demo-lab', {}),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('updates and clears title', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    quizRepository.findAdminByLabId.mockResolvedValue(quiz as never);
    quizRepository.updateTitle.mockResolvedValue({
      ...quiz,
      title: null,
    } as never);

    const result = await updateUseCase.execute('demo-lab', { title: null });
    expect(result.title).toBeNull();
    expect(quizRepository.updateTitle).toHaveBeenCalled();
  });

  it('gets admin quiz', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    quizRepository.findAdminByLabId.mockResolvedValue(quiz as never);

    const result = await getUseCase.execute('demo-lab');
    expect(result.id).toBe('quiz-1');
  });

  it('deletes quiz without touching completions', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    quizRepository.findByLabId.mockResolvedValue(quiz as never);
    quizRepository.delete.mockResolvedValue(undefined);

    await deleteUseCase.execute('demo-lab');
    expect(quizRepository.delete).toHaveBeenCalledWith(quiz);
  });
});
