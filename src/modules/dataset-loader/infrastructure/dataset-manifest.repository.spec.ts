import { ConfigService } from '@nestjs/config';
import { DatasetTier } from '@db-play/types';
import { DatasetManifestRepository } from './dataset-manifest.repository';

describe('DatasetManifestRepository', () => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        'dataset.manifestPath': 'seeds/datasets/manifest.json',
        'dataset.defaultVersion': 'v1',
      };
      return values[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;

  const repository = new DatasetManifestRepository(configService);

  it('loads commerce family from manifest', () => {
    const manifest = repository.getManifest();
    expect(manifest.families.some((family) => family.id === 'commerce')).toBe(
      true,
    );
  });

  it('resolves commerce v1 100k identity', () => {
    const identity = repository.resolveIdentity(
      'commerce',
      DatasetTier.TIER_100K,
      'v1',
    );

    expect(identity.family.id).toBe('commerce');
    expect(identity.version.id).toBe('v1');
    expect(identity.tier.id).toBe(DatasetTier.TIER_100K);
    expect(identity.tier.tables).toHaveLength(5);
  });

  it('throws for unknown family', () => {
    expect(() =>
      repository.resolveIdentity('unknown', DatasetTier.TIER_100K, 'v1'),
    ).toThrow();
  });

  it('throws for unknown version', () => {
    expect(() =>
      repository.resolveIdentity('commerce', DatasetTier.TIER_100K, 'v99'),
    ).toThrow();
  });
});
