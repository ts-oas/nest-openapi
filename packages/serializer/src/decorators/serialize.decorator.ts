import "reflect-metadata";
import { SetMetadata } from "@nestjs/common";

export interface SerializeOverrideOptions {
  /** Disable serialization on this route */
  disable?: boolean;
  /** Content-type preference for this route */
  contentType?: string;
}

export const SERIALIZE_OVERRIDE = Symbol("SERIALIZE_OVERRIDE");
export const Serialize = (options: SerializeOverrideOptions = {}) =>
  SetMetadata(SERIALIZE_OVERRIDE, options);
