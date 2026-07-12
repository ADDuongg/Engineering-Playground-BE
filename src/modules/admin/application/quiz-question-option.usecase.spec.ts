import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { CreateQuizQuestionUseCase } from './create-quiz-question.usecase';
import { CreateQuizOptionUseCase } from './create-quiz-option.usecase';
import { DeleteQuizOptionUseCase } from './delete-quiz-option.usecase';
import { ReorderQuizQuestionsUseCase } from './reorder-quiz-questions.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';

describe('Quiz question/option admin use cases', () => {
  let createQuestion: CreateQuizQuestionUseCase;
  let createOption: CreateQuizOptionUseCase;
  let deleteOption: DeleteQuizOptionUseCase;
  let reorderQuestions: ReorderQuizQuestionsUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;
  let questionRepository: jest.Mocked<QuizQuestionRepository>;

  const lab = { id: 'lab-1', slug: 'demo-lab' };
  const quiz = { id: 'quiz-1', labId: 'lab-1' };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn().mockResolvedValue(lab),
    } as unknown as jest.Mocked<LabRepository>;
    quizRepository = {
      findByLabId: jest.fn().mockResolvedValue(quiz),
    } as unknown as jest.Mocked<QuizRepository>;
    questionRepository = {
      createWithOptions: jest.fn(),
      findByIdAndQuizId: jest.fn(),
      createOption: jest.fn(),
      deleteOption: jest.fn(),
      findOrderedByQuizId: jest.fn(),
      reorderQuestions: jest.fn(),
    } as unknown as jest.Mocked<QuizQuestionRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuizQuestionUseCase,
        CreateQuizOptionUseCase,
        DeleteQuizOptionUseCase,
        ReorderQuizQuestionsUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: QuizRepository, useValue: quizRepository },
        { provide: QuizQuestionRepository, useValue: questionRepository },
      ],
    }).compile();

    createQuestion = module.get(CreateQuizQuestionUseCase);
    createOption = module.get(CreateQuizOptionUseCase);
    deleteOption = module.get(DeleteQuizOptionUseCase);
    reorderQuestions = module.get(ReorderQuizQuestionsUseCase);
  });

  it('creates question with inline options', async () => {
    questionRepository.createWithOptions.mockResolvedValue({
      id: 'q1',
      prompt: 'P?',
      questionType: 'single_select',
      sequenceOrder: 1,
      options: [
        {
          id: 'o1',
          label: 'A',
          sequenceOrder: 1,
          isCorrect: true,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
        },
        {
          id: 'o2',
          label: 'B',
          sequenceOrder: 2,
          isCorrect: false,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
        },
      ],
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await createQuestion.execute('demo-lab', {
      prompt: 'P?',
      sequenceOrder: 1,
      options: [
        { label: 'A', sequenceOrder: 1, isCorrect: true },
        { label: 'B', sequenceOrder: 2, isCorrect: false },
      ],
    });

    expect(result.id).toBe('q1');
    expect(result.options[0].isCorrect).toBe(true);
  });

  it('rejects question create with two correct options', async () => {
    await expect(
      createQuestion.execute('demo-lab', {
        prompt: 'P?',
        sequenceOrder: 1,
        options: [
          { label: 'A', sequenceOrder: 1, isCorrect: true },
          { label: 'B', sequenceOrder: 2, isCorrect: true },
        ],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('rejects option delete that would leave invalid answer key', async () => {
    questionRepository.findByIdAndQuizId.mockResolvedValue({
      id: 'q1',
      quizId: 'quiz-1',
      options: [
        { id: 'o1', isCorrect: true },
        { id: 'o2', isCorrect: false },
      ],
    } as never);

    await expect(
      deleteOption.execute('demo-lab', 'q1', 'o1'),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(questionRepository.deleteOption).not.toHaveBeenCalled();
  });

  it('creates option when projected answer key remains valid', async () => {
    questionRepository.findByIdAndQuizId.mockResolvedValue({
      id: 'q1',
      quizId: 'quiz-1',
      options: [
        { id: 'o1', isCorrect: true },
        { id: 'o2', isCorrect: false },
      ],
    } as never);
    questionRepository.createOption.mockResolvedValue({
      id: 'o3',
      label: 'C',
      sequenceOrder: 3,
      isCorrect: false,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await createOption.execute('demo-lab', 'q1', {
      label: 'C',
      sequenceOrder: 3,
      isCorrect: false,
    });
    expect(result.id).toBe('o3');
  });

  it('reorders questions with exact id set', async () => {
    questionRepository.findOrderedByQuizId.mockResolvedValue([
      { id: 'q1', options: [] },
      { id: 'q2', options: [] },
    ] as never);
    questionRepository.reorderQuestions.mockResolvedValue([
      {
        id: 'q2',
        prompt: '2',
        questionType: 'single_select',
        sequenceOrder: 1,
        options: [],
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      },
      {
        id: 'q1',
        prompt: '1',
        questionType: 'single_select',
        sequenceOrder: 2,
        options: [],
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    ] as never);

    const result = await reorderQuestions.execute('demo-lab', {
      questionIds: ['q2', 'q1'],
    });
    expect(result.questions.map((q) => q.id)).toEqual(['q2', 'q1']);
  });

  it('rejects incomplete reorder', async () => {
    questionRepository.findOrderedByQuizId.mockResolvedValue([
      { id: 'q1' },
      { id: 'q2' },
    ] as never);

    await expect(
      reorderQuestions.execute('demo-lab', { questionIds: ['q1'] }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });
});
