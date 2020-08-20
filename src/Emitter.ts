import CallableInstance from "callable-instance";
// import { TemitClient } from "./TemitClient";

export interface EmitterOptions {
  foo?: string;
}

export class Emitter<Args extends unknown[]> extends CallableInstance<
  Args,
  Promise<void>
> {
  // private temit: TemitClient;
  // private event: string;

  constructor(/* temit: TemitClient, event: string, opts: EmitterOptions = {} */) {
    super("send");

    // this.temit = temit;
    // this.event = event;
  }

  // public close() {}

  public async send(...args: Args): Promise<void> {
    return;
  }
}
