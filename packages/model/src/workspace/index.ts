import { config } from "../registries";
import Document from "../document";
import type { DocumentData } from "../document";
import { DocumentCollection } from "../document";
import type { DocumentCollectionData } from "../document";
import { uniqueId } from "../utils";

export default class Workspace {
  private document?: Document;
  private documentCollection?: DocumentCollection;

  initDocument(type: string, version: string, data?: Partial<DocumentData>): Document {
    if (this.document) {
      return this.document;
    }

    const { id, ...rests } = data || {};
    this.document = new Document(
      {
        id: id || uniqueId("doc"),
        documentType: type,
        documentVersion: version,
        ...rests,
      },
      config.getDocSettings(),
    );

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
    if (!this.document) {
      throw new Error("Document is not initialized.");
    }

    return this.document;
  }

  getDocumentCollection(): DocumentCollection {
    if (!this.documentCollection) {
      throw new Error("DocumentCollection is not initialized.");
    }

    return this.documentCollection;
  }
}
