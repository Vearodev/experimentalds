export type TokenType =
  | 'color'
  | 'dimension'
  | 'number'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'shadow';
export interface Token {
  $type: TokenType;
  $value: any;
  $description: string;
  $extensions?: Record<string, any>;
  source?: string;
}
export type TokenMap = Record<string, Token>;
export interface ResolvedToken extends Token {
  path: string;
  value: any;
  references: string[];
  css: string;
  cssValue: string;
}
export const supportedTypes: TokenType[];
export function cssName(path: string): string;
export function referencesIn(value: unknown): string[];
export function flatten(document: unknown, source?: string): TokenMap;
export function mergeDocuments(documents: { document: unknown; source?: string }[]): TokenMap;
export function resolveGraph(
  tokens: TokenMap,
  options?: { enforceLayers?: boolean },
): Record<string, ResolvedToken>;
export function toCss(type: TokenType, value: any): string;
export function impactOf(tokens: TokenMap, path: string): string[];
export function chainOf(tokens: TokenMap, path: string): string[];
export function nest(tokens: TokenMap): Record<string, unknown>;
export function colorFromHex(hex: string): {
  colorSpace: 'srgb';
  components: number[];
  alpha: number;
};
export function contrastRatio(a: any, b: any): number;
