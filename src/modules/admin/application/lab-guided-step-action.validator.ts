import { ErrorCode, LAB_GUIDED_STEP_ACTIONS, LabGuidedStepAction } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

export function assertLabGuidedStepAction(
  action: string,
): asserts action is LabGuidedStepAction {
  if (!(LAB_GUIDED_STEP_ACTIONS as readonly string[]).includes(action)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Unknown guided step action "${action}"`,
      400,
      { field: 'action', action },
    );
  }
}
