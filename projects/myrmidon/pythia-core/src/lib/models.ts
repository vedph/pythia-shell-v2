/**
 * Interface for models having a user ID.
 */
export interface HasUserId {
  userId?: string;
}

/**
 * Corpus model. A corpus is an arbitrary grouping of documents.
 * It has a title and description, and may contain a list of
 * document IDs.
 */
export interface Corpus extends HasUserId {
  id: string;
  title: string;
  description: string;
  documentIds?: number[];
}

/**
 * A generic attribute model. Attributes are key-value pairs associated
 * with objects like documents or text spans. The targetId field indicates
 * the ID of the object the attribute is associated with, and the name
 * and value fields store the attribute's key and value, respectively.
 */
export interface Attribute {
  targetId: number;
  name: string;
  value: string;
}

/**
 * A configuration profile, used to store settings for document processing
 * or analysis. Usually settings are stored in the content field as a JSON string.
 */
export interface Profile extends HasUserId {
  id: string;
  content?: string;
  type?: string;
}

/**
 * A text document model. It has an ID, author, title, date value (as a timestamp),
 * sort key, source, profile ID, last modified date, and a list of attributes.
 * The content field is optional and may contain the full text of the document.
 */
export interface Document {
  id: number;
  author: string;
  title: string;
  dateValue: number;
  sortKey: string;
  source: string;
  profileId: string;
  lastModified: Date;
  attributes: Attribute[];
  content?: string;
}

/**
 * A term in an index, with an ID, value, and count of occurrences.
 */
export interface IndexTerm {
  id: number;
  value: string;
  count: number;
}

/**
 * A node in a text document map, representing a range of text with
 * a label and location. Document maps provide navigation and structure
 * to text documents. Each node has a label, a location (e.g. an XPath
 * expression if documents are XML), start and end positions in the text,
 * and may have child nodes for nested structures. The selected field
 * indicates whether the node is currently selected in the UI.
 */
export interface TextMapNode {
  label: string;
  location: string;
  start: number;
  end: number;
  selected?: boolean;
  children?: TextMapNode[];
  parent?: TextMapNode;
}

/**
 * A request to read a document, with the document ID and optional
 * parameters.
 */
export interface DocumentReadRequest {
  documentId: number;
  start?: number;
  end?: number;
  initialPath?: string;
}
