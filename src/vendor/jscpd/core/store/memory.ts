import type { IStore } from "..";

export class MemoryStore<IMapFrame> implements IStore<IMapFrame> {
  private _namespace: string = "";

  protected values: Record<string, Record<string, IMapFrame>> = {};

  public namespace(namespace: string): void {
    this._namespace = namespace;
    this.values[namespace] = this.values[namespace] || {};
  }

  public get(key: string): Promise<IMapFrame> {
    return new Promise((resolve, reject) => {
      const namespaceValues = this.values[this._namespace];
      if (namespaceValues && key in namespaceValues) {
        resolve(namespaceValues[key] as IMapFrame);
      } else {
        reject(new Error("not found"));
      }
    });
  }

  public set(key: string, value: IMapFrame): Promise<IMapFrame> {
    const namespaceValues = this.values[this._namespace] ?? (this.values[this._namespace] = {});
    namespaceValues[key] = value;
    return Promise.resolve(value);
  }

  close(): void {
    this.values = {};
  }
}
