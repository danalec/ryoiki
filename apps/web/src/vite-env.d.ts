/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module '@cc/analyzer' {
  export function init(): Promise<void>
  export function parse_cc_json(json: string): any
  export function layout_treemap(tree: any, width: number, height: number): any
  export function get_language_colors(): any
  export default init
}
