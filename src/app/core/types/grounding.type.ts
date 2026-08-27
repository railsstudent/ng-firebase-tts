import { WebGroundingChunk } from 'firebase/ai';

export interface Metadata {
  citations: WebGroundingChunk[];
  renderedContent: string;
  searchQueries: string[];
}
