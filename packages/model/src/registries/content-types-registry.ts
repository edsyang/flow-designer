import semver from "semver";
import type { ContentType } from "../content";
import type { ContentTransformer } from "../types";
import { cloneRegistration } from "./clone";
interface Registration<T> {
  value: T;
}
export default class ContentTypesRegistry {
  private contentTypes: Registration<ContentType>[] = [];
  private transformers: Registration<ContentTransformer>[] = [];
  private disposed = false;
  private add<T>(entries: Registration<T>[], value: T): () => void {
    if (this.disposed) throw new Error("Content types registry has been disposed");
    const entry = { value };
    entries.push(entry);
    return () => {
      const index = entries.indexOf(entry);
      if (index >= 0) entries.splice(index, 1);
    };
  }
  register(contentType: ContentType): () => void {
    return this.add(this.contentTypes, contentType);
  }
  getSuitableContentType(documentType = "default", documentVersion?: string): ContentType | null {
    // An instance override wins over its earlier bootstrap registration.
    const types = this.contentTypes.map((entry) => entry.value).reverse();
    return (
      types.find(
        (item) =>
          item.compatibleType === documentType &&
          (!documentVersion || semver.satisfies(documentVersion, item.compatibleVersion)),
      ) ??
      types.find((item) => item.compatibleType === "*") ??
      null
    );
  }
  registerTransformer(transformer: ContentTransformer): () => void {
    return this.add(this.transformers, cloneRegistration(transformer));
  }
  private transformer(format: string): ContentTransformer {
    const entry = [...this.transformers].reverse().find((item) => item.value.format === format);
    if (!entry) throw new Error(`No transformer registered for format: ${format}`);
    return entry.value;
  }
  transform(format: string, externalData: unknown): unknown {
    return this.transformer(format).transformIn(externalData);
  }
  transformOut(format: string, data: unknown): unknown {
    return this.transformer(format).transformOut(data);
  }
  fork(): ContentTypesRegistry {
    const registry = new ContentTypesRegistry();
    for (const entry of this.contentTypes) registry.register(entry.value);
    for (const entry of this.transformers) registry.registerTransformer(entry.value);
    return registry;
  }
  dispose(): void {
    this.disposed = true;
    this.contentTypes.length = 0;
    this.transformers.length = 0;
  }
}
