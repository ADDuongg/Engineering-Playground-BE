import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DatasetTier, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import {
  DatasetManifest,
  DatasetFamilyManifest,
  ResolvedDatasetIdentity,
} from '../domain/dataset-manifest.types';

@Injectable()
export class DatasetManifestRepository {
  private cachedManifest: DatasetManifest | null = null;

  constructor(private readonly configService: ConfigService) {}

  getManifest(): DatasetManifest {
    if (this.cachedManifest) {
      return this.cachedManifest;
    }

    const manifestPath = this.configService.get<string>(
      'dataset.manifestPath',
      'seeds/datasets/manifest.json',
    );
    const absolutePath = join(process.cwd(), manifestPath);

    if (!existsSync(absolutePath)) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Dataset manifest is not available on this platform.',
        404,
        {
          code: 'MANIFEST_NOT_FOUND',
          hint: 'Contact platform support — learning datasets may not be deployed yet.',
        },
      );
    }

    const raw = readFileSync(absolutePath, 'utf-8');
    this.cachedManifest = JSON.parse(raw) as DatasetManifest;
    return this.cachedManifest;
  }

  resolveIdentity(
    familyId: string,
    tier: DatasetTier,
    version?: string,
  ): ResolvedDatasetIdentity {
    const manifest = this.getManifest();
    const family = manifest.families.find((item) => item.id === familyId);

    if (!family) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Dataset family "${familyId}" is not available.`,
        404,
        {
          code: 'UNKNOWN_FAMILY',
          hint: 'This lab references a dataset that does not exist. Check the lab configuration.',
        },
      );
    }

    const resolvedVersion = version ?? this.getDefaultVersion();
    const versionManifest = family.versions.find(
      (item) => item.id === resolvedVersion,
    );

    if (!versionManifest) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Dataset version "${resolvedVersion}" is not available for family "${familyId}".`,
        404,
        {
          code: 'UNKNOWN_VERSION',
          hint: 'The lab may reference an outdated dataset version. Try refreshing or contact support.',
        },
      );
    }

    const tierManifest = versionManifest.tiers.find((item) => item.id === tier);

    if (!tierManifest) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Tier "${tier}" is not supported for dataset "${familyId}" version "${resolvedVersion}".`,
        400,
        {
          code: 'UNKNOWN_TIER',
          hint: 'Choose a supported size tier: 100k, 1m, or 10m.',
        },
      );
    }

    this.assertSeedFilesExist(family, versionManifest, tierManifest);

    return {
      family,
      version: versionManifest,
      tier: tierManifest,
    };
  }

  getFamily(familyId: string): DatasetFamilyManifest {
    const manifest = this.getManifest();
    const family = manifest.families.find((item) => item.id === familyId);

    if (!family) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Dataset family "${familyId}" is not available.`,
        404,
        {
          code: 'UNKNOWN_FAMILY',
          hint: 'This lab references a dataset that does not exist. Check the lab configuration.',
        },
      );
    }

    return family;
  }

  getDefaultVersion(): string {
    return this.configService.get<string>('dataset.defaultVersion', 'v1');
  }

  getSeedsRoot(): string {
    const manifestPath = this.configService.get<string>(
      'dataset.manifestPath',
      'seeds/datasets/manifest.json',
    );
    return join(process.cwd(), manifestPath, '..');
  }

  private assertSeedFilesExist(
    family: DatasetFamilyManifest,
    version: ResolvedDatasetIdentity['version'],
    tier: ResolvedDatasetIdentity['tier'],
  ): void {
    const seedsRoot = this.getSeedsRoot();
    const schemaPath = join(seedsRoot, version.schemaPath);
    const seedPath = join(seedsRoot, tier.seedPath);

    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Seed artifacts for "${family.id}" version "${version.id}" tier "${tier.id}" are missing.`,
        404,
        {
          code: 'SEED_ARTIFACTS_MISSING',
          hint: 'Platform operators need to publish the dataset seed files before this lab can run.',
        },
      );
    }
  }
}
