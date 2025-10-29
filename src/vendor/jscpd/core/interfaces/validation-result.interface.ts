import type { IClone } from "..";

export interface IValidationResult {
  status: boolean;
  message?: string[];
  clone?: IClone;
}
