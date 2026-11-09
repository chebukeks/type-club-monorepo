declare module 'nspell' {
  interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
    remove(word: string): void;
    personal(dic: string): void;
  }
  function nspell(aff: any, dic?: any): NSpellInstance;
  export default nspell;
}

declare module 'dictionary-ru' {
  const dictionary: { aff: any; dic: any };
  export default dictionary;
}

declare module 'dictionary-en' {
  const dictionary: { aff: any; dic: any };
  export default dictionary;
}

declare module 'mammoth' {
  export interface ImageElement {
    read(encoding: string): Promise<string>;
    contentType: string;
  }
  export interface ConvertResult {
    value: string;
    messages: Array<any>;
  }
  export const images: {
    imgElement(handler: (image: ImageElement) => Promise<{ src: string }>): any;
  };
  export function convertToMarkdown(input: { buffer: Buffer }, options?: any): Promise<ConvertResult>;
  export function convertToHtml(input: { buffer: Buffer }, options?: any): Promise<ConvertResult>;
}
