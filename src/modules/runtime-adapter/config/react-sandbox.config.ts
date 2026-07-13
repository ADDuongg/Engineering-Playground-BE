import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_REACT_SANDBOX_POLICY,
  ReactSandboxPolicy,
} from '../domain/react-sandbox-policy';

@Injectable()
export class ReactSandboxConfig {
  constructor(private readonly configService: ConfigService) {}

  getPolicy(): ReactSandboxPolicy {
    return {
      timeoutMs: this.configService.get<number>(
        'reactSandbox.timeoutMs',
        DEFAULT_REACT_SANDBOX_POLICY.timeoutMs,
      ),
      maxInteractions: this.configService.get<number>(
        'reactSandbox.maxInteractions',
        DEFAULT_REACT_SANDBOX_POLICY.maxInteractions,
      ),
      maxItems: this.configService.get<number>(
        'reactSandbox.maxItems',
        DEFAULT_REACT_SANDBOX_POLICY.maxItems,
      ),
      policyVersion: this.configService.get<string>(
        'reactSandbox.policyVersion',
        DEFAULT_REACT_SANDBOX_POLICY.policyVersion,
      ),
    };
  }
}
