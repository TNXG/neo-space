declare module "*.css";

declare module "~icons/*/icon-name" {
  import type { SVGProps } from "react";

  const content: React.FC<SVGProps<SVGSVGElement>>;
  export default content;
}

declare module "~icons/*" {
  import type { SVGProps } from "react";

  const content: React.FC<SVGProps<SVGSVGElement>>;
  export default content;
}

declare module "wink-tokenizer" {
  interface Token {
    value: string;
    tag: "word" | "number" | "url" | "email" | "mention" | "hashtag" | "emoji" | "punctuation" | "symbol" | "currency" | "time" | "ordinal" | "quoted_phrase" | "alien";
  }

  class Tokenizer {
    tokenize(text: string): Token[];
    defineConfig(config: Record<string, boolean>): number;
    getTokensFP(): string[];
    addToken(pattern: RegExp, tag: string): void;
  }

  export = Tokenizer;
}
