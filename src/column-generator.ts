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
export class ColumnGenerator {
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

  constructor(
    tableData: TableData,
    dialect: DialectOptions,
    options: AutoOptions
  ) {
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
      header += "import { ProColumns } from '@ant-design/pro-components';\n\n";
    }
    return header;
  }

  generateText() {
    const tableNames = _.keys(this.tables);

    const header = this.makeHeaderTemplate();

    const text: { [name: string]: string } = {};
    tableNames.forEach(table => {
      let str = header;
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      if (this.options.lang === 'ts') {
        str += `export const #TABLE#Columns: ProColumns<#TABLE#>[] = [\n`;
        // str += 'export class #TABLE# extends #ENTITY# {\n';
        str += this.addFormColumns(table, true);
        str += ']\n';
      }

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

      // const ere = new RegExp('#ENTITY#', 'g');
      // let entityName = 'DomainObject';
      // if (this.options.extendMode === 'entity') {
      //   entityName = 'BaseEntity';
      // } else if (this.options.extendMode === 'vo') {
      //   entityName = 'BaseValueObject';
      // }
      // str = str.replace(ere, entityName);

      text[table] = str;
    });

    return text;
  }

  private addFormColumns(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    const notNull = isInterface ? '' : '!';
    let str = '';
    let counter = 0;
    fields.forEach(field => {
      if (!this.isIgnoredField(field)) {
        if (
          (!this.isDeprecated(table, field) &&
            !this.isJSONField(table, field)) ||
          this.isUid(field)
        ) {
          const name = this.quoteName(recase(this.options.caseProp, field));
          const isOptional = this.getTypeScriptFieldOptional(table, field);
          // str += this.getFieldAnnotation(table, field);
          str += '  {\n';
          str += `    dataIndex: '${name}',\n`;
          str += this.getTitle(table, field);
          str += `    valueType: '${this.getFormValueType(table, field)}',\n`;
          str += this.getHideInTable(field);
          str += this.getHideInSearch(field, counter);
          str += this.getHideInForm(field);
          str += '    ellipsis: true\n';
          str += '  },\n';
        }
      }
      counter++;
    });
    return str;
  }

  private getTitle(table: string, field: string) {
    if (field === 'created_date') {
      return "    title: '创建时间',\n";
    }
    if (field === 'last_updated_date') {
      return "    title: '最后更新时间',\n";
    }
    const fieldObj = this.tables[table][field] as TSField;
    if (fieldObj.comment) {
      return `    title: '${fieldObj.comment}',\n`;
    }
    return '';
  }

  private getHideInTable(field: string) {
    if (/(uid)$/.test(field)) {
      return '    hideInTable: true,\n';
    }
    return '';
  }

  private getHideInSearch(field: string, counter: number) {
    if (/(name|_no|_code)$/.test(field) && counter < 11) {
      return '    hideInSearch: false,\n';
    }
    return '    hideInSearch: true,\n';
  }

  private getHideInForm(field: string) {
    if (
      [
        'uid',
        'createdBy',
        'createdDate',
        'lastUpdatedBy',
        'lastUpdatedDate',
      ].includes(recase('c', field))
    ) {
      return '    hideInForm: true,\n';
    }
    return '';
  }

  private getTypeScriptFieldOptional(table: string, field: string) {
    const fieldObj = this.tables[table][field];
    return fieldObj.allowNull;
  }

  private isDeprecated(table: string, field: string) {
    return (
      this.tables[table][field].comment &&
      this.tables[table][field].comment?.startsWith('~')
    );
  }

  private isJSONField(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    const rawFieldType = fieldObj['type'] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    return this.isJSON(fieldType);
  }

  private getFormValueType(table: string, field: string) {
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
      jsType = 'switch';
    } else if (this.isNumber(fieldType)) {
      jsType = 'digit';
    } else if (this.isDate(fieldType)) {
      jsType = 'date';
    } else if (this.isDateTime(fieldType)) {
      jsType = 'dateTime';
    } else if (this.isString(fieldType)) {
      jsType = 'text';
    } else if (this.isEnum(fieldType)) {
      const values = this.getEnumValues(fieldObj);
      jsType = values.join(' | ');
    } else if (this.isJSON(fieldType)) {
      jsType = 'jsonCode';
    } else {
      console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
      jsType = 'any';
    }
    return jsType;
  }

  private getFieldRuleType(
    field: string,
    fieldObj: TSField,
    attr: keyof TSField
  ) {
    const rawFieldType = fieldObj[attr] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    const length = fieldType.match(/\(\d+\)/);

    let ruleType: string | undefined = '';

    if (this.isArray(fieldType)) {
      // const eltype = this.getTypeScriptFieldType(fieldObj, "elementType");
      ruleType += `RuleType.array().items(${this.getFieldRuleType(
        field,
        fieldObj,
        'elementType'
      )})`;
    } else if (this.isNumber(fieldType)) {
      ruleType += 'RuleType.number()';
    } else if (this.isBoolean(fieldType)) {
      ruleType += 'RuleType.boolean()';
    } else if (this.isDate(fieldType)) {
      ruleType += 'RuleType.date()';
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
        ruleType += '.allow("")';
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
      return fieldObj.special.map(v => `"${v}"`);
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
      (!additional.createdAt &&
        (recase('c', field) === 'createdAt' ||
          recase('c', field) === 'createdDate')) ||
      additional.createdAt === field ||
      (!additional.updatedAt &&
        (recase('c', field) === 'updatedAt' ||
          recase('c', field) === 'lastUpdatedDate')) ||
      additional.updatedAt === field
    );
  }

  private isParanoidField(field: string) {
    const additional = this.options.additional;
    if (additional.timestamps === false || additional.paranoid === false) {
      return false;
    }
    return (
      (!additional.deletedAt && recase('c', field) === 'deletedAt') ||
      additional.deletedAt === field
    );
  }

  private isIgnoredField(field: string) {
    if (
      this.options.extendMode === 'entity' ||
      this.options.extendMode === 'vo'
    ) {
      return ['id', 'tenantId'].includes(recase('c', field));
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
    // return /^(date)/.test(fieldType);
    return fieldType === 'date';
  }

  private isDateTime(fieldType: string): boolean {
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
