export interface Metrics {
  loc: number;
  complexity?: number;
  functions?: number;
}

export interface CodeTree {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  metrics: Metrics;
  language: string;
  children?: CodeTree[];
}

export interface RectNode {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  metrics: Metrics;
  language: string;
}

export interface BuildingData {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  metadata: RectNode;
}

export interface LanguageColors {
  [key: string]: string;
}