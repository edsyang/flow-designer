import semver from 'semver';
import type { ContentType } from '../content';
import type { ContentTransformer } from '../types';

export default class ContentTypesRegistry {
  private contentTypes: ContentType[] = [];
  private transformers: ContentTransformer[] = [];

  register(contentType: ContentType) {
    this.contentTypes.push(contentType);
  }

  getSuitableContentType(documentType: string = 'default', documentVersion?: string): ContentType | null {
    const exact = this.contentTypes.find((item: ContentType) => {
      return (
        item.compatibleType === documentType
        && (!documentVersion || semver.satisfies(documentVersion, item.compatibleVersion))
      );
    });
    if (exact) return exact;

    return this.contentTypes.find((item: ContentType) => item.compatibleType === '*') || null;
  }

  registerTransformer(transformer: ContentTransformer): () => void {
    this.transformers.push(transformer);
    return () => {
      const index = this.transformers.indexOf(transformer);
      if (index >= 0) this.transformers.splice(index, 1);
    };
  }

  transform(format: string, externalData: unknown): any {
    const transformer = this.transformers.find(t => t.format === format);
    if (!transformer) {
      throw new Error(`No transformer registered for format: ${format}`);
    }
    return transformer.transformIn(externalData);
  }

  transformOut(format: string, data: any): unknown {
    const transformer = this.transformers.find(t => t.format === format);
    if (!transformer) {
      throw new Error(`No transformer registered for format: ${format}`);
    }
    return transformer.transformOut(data);
  }
}
