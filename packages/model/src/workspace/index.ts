import { config } from '../registries';
import Document from '../document';
import type { DocumentData } from '../document';
import { DocumentCollection } from '../document';
import type { DocumentCollectionData } from '../document';
import { uniqueId } from '../utils';

export default class Workspace {
  private document!: Document;
  private documentCollection!: DocumentCollection;

  initDocument(type: string, version: string, data?: Partial<DocumentData>): Document {
    if (this.document) {
      return this.document;
    }

    const { id, documentType, documentVersion, ...rest } = data || {};
    this.document = new Document({
      id: id || uniqueId('doc'),
      documentType: type,
      documentVersion: version,
      ...rest,
    }, config.getDocSettings());
    return this.document;
  }

  initDocumentCollection(data: DocumentCollectionData): DocumentCollection {
    if (this.documentCollection) {
      return this.documentCollection;
    }

    this.documentCollection = new DocumentCollection(data, config.getDocSettings());
    return this.documentCollection;
  }

  getDocument(): Document {
    return this.document;
  }

  getDocumentCollection(): DocumentCollection {
    return this.documentCollection;
  }
}
