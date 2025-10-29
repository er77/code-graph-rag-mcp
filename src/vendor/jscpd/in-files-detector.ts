import type { IClone, IMapFrame, IOptions, IStore, ISubscriber, ITokenizer } from "./core";
import { Detector } from "./core";
import type { EntryWithContent } from "./files";
import { getFilesToDetect } from "./files";

export type DetectorSource = EntryWithContent;

export class InFilesDetector {
  constructor(
    private readonly tokenizer: ITokenizer,
    private readonly store: IStore<IMapFrame>,
    private readonly options: IOptions,
    private readonly subscribers: ISubscriber[] = [],
  ) {}

  async detectFromOptions(options: IOptions): Promise<IClone[]> {
    const files = getFilesToDetect(options);
    return this.detect(files);
  }

  async detect(files: EntryWithContent[]): Promise<IClone[]> {
    const entries = [...files];
    if (entries.length === 0) return [];

    const detector = new Detector(this.tokenizer, this.store, [], this.options);
    for (const subscriber of this.subscribers) {
      const hooks = subscriber.subscribe();
      Object.entries(hooks).forEach(([event, handler]) => {
        if (handler) {
          detector.on(event, handler);
        }
      });
    }

    const clones: IClone[] = [];

    for (const entry of entries) {
      const detected = await detector.detect(entry.path, entry.content, this.resolveFormat(entry.path));
      clones.push(...detected);
    }

    return clones;
  }

  private resolveFormat(path: string): string {
    return path.split(".").pop() ?? "text";
  }
}
