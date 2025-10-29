import type { DetectorEvents, IClone, ITokensMap, IValidationResult } from "..";

export interface ISubscriber {
  subscribe(): Partial<Record<DetectorEvents, IHandler>>;
}

export type IHandler = (payload: IEventPayload) => void;

export interface IEventPayload {
  clone?: IClone;
  source?: ITokensMap;
  validation?: IValidationResult;
}
