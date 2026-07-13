import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabReactFixtureAllowlistService } from './lab-react-fixture-allowlist.service';

describe('LabReactFixtureAllowlistService', () => {
  const labRepository = {
    findBySlug: jest.fn(),
  };
  const stepRepository = {
    findOrderedByLabId: jest.fn(),
  };

  const service = new LabReactFixtureAllowlistService(
    labRepository as never,
    stepRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives fixture ids from guided step reactScenario.scenarioId', async () => {
    labRepository.findBySlug.mockResolvedValue({ id: 'lab-1', slug: 'react-rendering' });
    stepRepository.findOrderedByLabId.mockResolvedValue([
      {
        payload: { reactScenario: { scenarioId: 'rendering/counter' } },
      },
      { payload: { recommendedQuery: { sql: 'SELECT 1' } } },
      {
        payload: { reactScenario: { scenarioId: 'rendering/counter' } },
      },
    ]);

    const ids = await service.getAllowedFixtureIds('react-rendering');
    expect([...ids]).toEqual(['rendering/counter']);
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);
    await expect(service.getAllowedFixtureIds('missing')).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(service.getAllowedFixtureIds('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('rejects cross-lab fixture probes', async () => {
    labRepository.findBySlug.mockResolvedValue({ id: 'lab-1', slug: 'react-rendering' });
    stepRepository.findOrderedByLabId.mockResolvedValue([
      { payload: { reactScenario: { scenarioId: 'rendering/counter' } } },
    ]);

    await expect(
      service.assertAllowed('react-rendering', 'keys/list'),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      details: expect.objectContaining({
        reason: 'FIXTURE_NOT_ALLOWED_FOR_LAB',
      }),
    });
  });
});
