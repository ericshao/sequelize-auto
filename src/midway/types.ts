import { LangOption, recase } from "../types";

export class Entity  {
  name: string;
  PascalCase: string;
  camelCase: string;
  lowerCase: string;
  uidField: string;
  label: string;
  text?: string;
  constructor(name: string, uidAbbrev: string, label: string) {
    this.name = name;
    this.PascalCase = recase('p', this.name, true);
    this.camelCase = recase('c', this.name, true);
    this.lowerCase = recase('l', this.name, true);
    this.label = label;
    this.uidField = `${uidAbbrev}Uid`;
  }
};

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