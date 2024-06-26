import { LangOption, camelToSlash, recase } from '../types';

export class Entity {
  name: string;
  PascalCase: string;
  camelCase: string;
  lowerCase: string;
  moduleName?: string;
  aggrName?: string;
  aggrKey?: string;
  label?: string;
  text?: string;
  slashPath?: string;
  constructor(
    name: string,
    label?: string,
    moduleName?: string,
    aggrName?: string,
    aggrKey?: string
  ) {
    this.name = name;
    this.PascalCase = recase('p', this.name, true);
    this.camelCase = recase('c', this.name, true);
    this.lowerCase = recase('l', this.name, true);
    this.slashPath = camelToSlash(this.camelCase);
    this.label = label;
    this.moduleName = moduleName;
    this.aggrName = aggrName;
    this.aggrKey = aggrKey;
  }
}

export interface AutoOptions {
  /** Where to write the model files */
  directory: string;
  /** Database host */
  host?: string;
  /** Number of spaces or tabs to indent (default 2) */
  indentation?: number;
  /** Model language */
  lang?: LangOption;
  /** Whether to skip writing the init-models file */
  noInitModels?: boolean;
  /** Whether to skip writing the files */
  noWrite?: boolean;

  /** Database schema to export */
  schema?: string;
  /** Whether to singularize model names */
  singularize: boolean;
}
