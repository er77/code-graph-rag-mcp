declare module "tree-sitter-javascript" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-python" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-c" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-cpp" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-rust" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-c-sharp" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-go" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-java" {
  import type { Language } from "tree-sitter";
  const Lang: Language;
  export default Lang;
}

declare module "tree-sitter-typescript" {
  import type { Language } from "tree-sitter";
  export const typescript: Language;
  export const tsx: Language;
  const _default: { typescript: Language; tsx: Language };
  export default _default;
}
