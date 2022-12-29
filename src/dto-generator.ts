import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from './dialects/dialect-options';
import {
  AutoOptions,
  CaseFileOption,
  CaseOption,
  IndexSpec,
  LangOption,
  makeIndent,
  makeTableName,
  qNameSplit,
  recase,
  Relation,
  TableData,
  TSField,
} from './types';

/** Generates text from each table in TableData */
export class DtoGenerator {
  dialect: DialectOptions;
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } };
  space: string[];
  options: {
    indentation?: number;
    spaces?: boolean;
    lang?: LangOption;
    caseModel?: CaseOption;
    caseProp?: CaseOption;
    caseFile?: CaseFileOption;
    skipFields?: string[];
    additional?: any;
    schema?: string;
    singularize: boolean;
    useDefine: boolean;
    noIndexes?: boolean;
    extendMode?: 'base' | 'entity' | 'vo';
    omitPrefix?: number;
  };

  constructor(tableData: TableData, dialect: DialectOptions, options: AutoOptions) {
    this.tables = tableData.tables;
    this.dialect = dialect;
    this.options = options;
    this.options.lang = this.options.lang || 'es5';
    this.space = makeIndent(this.options.spaces, this.options.indentation);
  }

  makeHeaderTemplate() {
    let header = '';
    const sp = this.space[1];

    if (this.options.lang === 'ts') {
      // header += "/* eslint-disable node/no-extraneous-import */\n";
      header += "import { Rule, RuleType, OmitDto } from '@midwayjs/validate';\n";
      header += "import { ApiProperty } from '@midwayjs/swagger';\n";
      header += "import { #ENTITY#, BizmetaProvider } from '@c2pkg/bizmeta';\n\n";
    }
    return header;
  }

  generateText() {
    const tableNames = _.keys(this.tables);

    const header = this.makeHeaderTemplate();

    const text: { [name: string]: string } = {};
    tableNames.forEach((table) => {
      let str = header;
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      if (this.options.lang === 'ts') {
        str += `@BizmetaProvider('#TABLE#')\n`;
        str += 'export class #TABLE# extends #ENTITY# {\n';
        str += this.addTypeScriptFields(table, true);
        str += '}\n\n';
      }

      str += "export class Create#TABLE#Dto extends OmitDto(#TABLE#, ['createdDate', 'lastUpdatedDate']) {}\n\n";
      str += "export class Update#TABLE#Dto extends OmitDto(#TABLE#, ['createdDate']) {\n";
      str += "@ApiProperty({ description: '批量更新UID' })\n";
      str += '@Rule(RuleType.array())\n';
      str += 'identifiers: number[] | string[];\n\n';
      str += "@ApiProperty({ description: '更新前值' })\n";
      str += '@Rule(RuleType.object())\n';
      str += 'oldValues: Partial<#TABLE#>;\n';
      str += '}\n\n';

      const additional = this.options.additional;
      // str += "export class Delete#TABLE#Dto extends PickDto(#TABLE#Dto, ['uid', 'tenantId']) {\n";
      // if (additional.paranoid) {
      //   str += "@ApiProperty({ description: '是否强制删除' })\n";
      //   str += '@Rule(RuleType.boolean())\n';
      //   str += 'force?: boolean;\n';
      // }
      // str += '}\n';
      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName.slice(this.options.omitPrefix));

      const ere = new RegExp('#ENTITY#', 'g');
      let entityName = 'DomainObject';
      if (this.options.extendMode === 'entity') {
        entityName = 'BaseEntity';
      } else if (this.options.extendMode === 'vo') {
        entityName = 'BaseValueObject';
      }
      str = str.replace(ere, entityName);

      text[table] = str;
    });

    return text;
  }

  private addTypeScriptFields(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    const notNull = isInterface ? '' : '!';
    let str = '';
    fields.forEach((field) => {
      if (!this.isIgnoredField(field)) {
        if (!this.isDeprecated(table, field)) {
          const name = this.quoteName(recase(this.options.caseProp, field));
          const isOptional = this.getTypeScriptFieldOptional(table, field);
          str += this.getFieldAnnotation(table, field);
          str += `${sp}${name}${isOptional ? '?' : notNull}: ${this.getTypeScriptType(table, field)};\n\n`;
        }
      }
    });
    return str;
  }

  private getTypeScriptFieldOptional(table: string, field: string) {
    const fieldObj = this.tables[table][field];
    return fieldObj.allowNull;
  }

  private isDeprecated(table: string, field: string) {
    return this.tables[table][field].comment && this.tables[table][field].comment?.startsWith('~');
  }

  private getFieldAnnotation(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    let str = '';

    const ruleType = this.getFieldRuleType(field, fieldObj, 'type');

    if (fieldObj.comment) {
      const [comment, extra] = fieldObj.comment.split('#');
      if (extra) {
        const valueEnum: any[] = [];
        extra.split(';').forEach((e) => {
          const [key, value] = e.split(':');
          valueEnum.push({ key, value });
        });
        str += `@ApiProperty({ description: '${comment}', enum:${JSON.stringify(valueEnum)} })\n`;
      } else {
        str += `@ApiProperty({ description: '${comment}' })\n`;
      }
    }

    if (ruleType) {
      str += `@Rule(${ruleType})\n`;
    }
    return str;
  }

  private getTypeScriptType(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    return this.getTypeScriptFieldType(fieldObj, 'type');
  }

  private getTypeScriptFieldType(fieldObj: TSField, attr: keyof TSField) {
    const rawFieldType = fieldObj[attr] || '';
    const fieldType = String(rawFieldType).toLowerCase();

    let jsType: string;

    if (this.isArray(fieldType)) {
      const eltype = this.getTypeScriptFieldType(fieldObj, 'elementType');
      jsType = eltype + '[]';
    } else if (this.isBoolean(fieldType)) {
      jsType = 'boolean';
    } else if (this.isNumber(fieldType)) {
      jsType = 'number';
    } else if (this.isDate(fieldType)) {
      jsType = 'Date';
    } else if (this.isString(fieldType)) {
      jsType = 'string';
    } else if (this.isEnum(fieldType)) {
      const values = this.getEnumValues(fieldObj);
      jsType = values.join(' | ');
    } else if (this.isJSON(fieldType)) {
      jsType = 'object';
    } else {
      console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
      jsType = 'any';
    }
    return jsType;
  }

  private getFieldRuleType(field: string, fieldObj: TSField, attr: keyof TSField) {
    const rawFieldType = fieldObj[attr] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    const length = fieldType.match(/\(\d+\)/);

    let ruleType: string | undefined = '';

    if (this.isArray(fieldType)) {
      // const eltype = this.getTypeScriptFieldType(fieldObj, "elementType");
      ruleType += `RuleType.array().items(${this.getFieldRuleType(field, fieldObj, 'elementType')})`;
    } else if (this.isNumber(fieldType)) {
      ruleType += 'RuleType.number().allow(null)';
    } else if (this.isBoolean(fieldType)) {
      ruleType += 'RuleType.boolean().allow(null)';
    } else if (this.isDate(fieldType)) {
      ruleType += 'RuleType.date().allow(null)';
    } else if (this.isString(fieldType)) {
      if (this.isUid(field)) {
        ruleType += 'RuleType.string().max(24).allow("")';
      } else {
        ruleType += 'RuleType.string()';
        if (!_.isNull(length)) {
          if (this.isChar(fieldType)) {
            ruleType += `.length(${length})`;
          } else {
            ruleType += `.max(${length})`;
          }
        }
        ruleType += '.allow("").allow(null)';
      }
      // } else if (this.isEnum(fieldType)) {
      //   const values = this.getEnumValues(fieldObj);
      //   ruleType += values.join(' | ');
    } else if (this.isJSON(fieldType)) {
      ruleType += 'RuleType.object()';
    } else {
      console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
      ruleType = undefined;
    }
    return ruleType;
  }

  private getEnumValues(fieldObj: TSField): string[] {
    if (fieldObj.special) {
      // postgres
      return fieldObj.special.map((v) => `"${v}"`);
    } else {
      // mysql
      return fieldObj.type.substring(5, fieldObj.type.length - 1).split(',');
    }
  }

  private isTimestampField(field: string) {
    const additional = this.options.additional;
    if (additional.timestamps === false) {
      return false;
    }
    return (
      (!additional.createdAt && (recase('c', field) === 'createdAt' || recase('c', field) === 'createdDate')) ||
      additional.createdAt === field ||
      (!additional.updatedAt && (recase('c', field) === 'updatedAt' || recase('c', field) === 'lastUpdatedDate')) ||
      additional.updatedAt === field
    );
  }

  private isParanoidField(field: string) {
    const additional = this.options.additional;
    if (additional.timestamps === false || additional.paranoid === false) {
      return false;
    }
    return (!additional.deletedAt && recase('c', field) === 'deletedAt') || additional.deletedAt === field;
  }

  private isIgnoredField(field: string) {
    if (this.options.extendMode === 'entity' || this.options.extendMode === 'vo') {
      return ['id', 'uid', 'tenantId', 'createdBy', 'createdDate', 'lastUpdatedBy', 'lastUpdatedDate'].includes(
        recase('c', field)
      );
    }
    return this.options.skipFields && this.options.skipFields.includes(field);
  }

  private escapeSpecial(val: string) {
    if (typeof val !== 'string') {
      return val;
    }
    return val
      .replace(/[\\]/g, '\\\\')
      .replace(/[\"]/g, '\\"')
      .replace(/[\/]/g, '\\/')
      .replace(/[\b]/g, '\\b')
      .replace(/[\f]/g, '\\f')
      .replace(/[\n]/g, '\\n')
      .replace(/[\r]/g, '\\r')
      .replace(/[\t]/g, '\\t');
  }

  /** Quote the name if it is not a valid identifier */
  private quoteName(name: string) {
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
  }

  private isNumber(fieldType: string): boolean {
    if (fieldType === 'tinyint(1) unsigned') {
      return false;
    }
    return /^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(
      fieldType
    );
  }

  private isBoolean(fieldType: string): boolean {
    if (fieldType === 'tinyint(1) unsigned') {
      return true;
    }
    return /^(boolean|bit)/.test(fieldType);
  }

  private isDate(fieldType: string): boolean {
    return /^(datetime|timestamp)/.test(fieldType);
  }

  private isString(fieldType: string): boolean {
    return /^(char|nchar|string|varying|varchar|nvarchar|text|longtext|mediumtext|tinytext|ntext|uuid|uniqueidentifier|date|time|inet|cidr|macaddr)/.test(
      fieldType
    );
  }

  private isChar(fieldType: string): boolean {
    return /^(char)/.test(fieldType);
  }

  private isArray(fieldType: string): boolean {
    return /(^array)|(range$)/.test(fieldType);
  }

  private isEnum(fieldType: string): boolean {
    return /^(enum)/.test(fieldType);
  }

  private isJSON(fieldType: string): boolean {
    return /^(json|jsonb)/.test(fieldType);
  }

  private isUid(attr: string): boolean {
    return /(uid)$/.test(attr);
  }
}
