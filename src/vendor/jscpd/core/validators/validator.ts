import type { IClone, ICloneValidator, IOptions, IValidationResult } from "..";

export function runCloneValidators(clone: IClone, options: IOptions, validators: ICloneValidator[]): IValidationResult {
  const acc: IValidationResult = { status: true, message: [], clone };

  for (const validator of validators) {
    const res = validator.validate(clone, options);
    acc.status = acc.status && res.status;

    if (res.message && acc.message) {
      acc.message.push(...res.message);
    }
  }

  return acc;
}
