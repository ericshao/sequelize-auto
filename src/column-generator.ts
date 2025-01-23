import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';

import {
  AutoOptions,
  CaseFileOption,
  CaseOption,
  IndexSpec,
  LangOption,
  Relation,
  TSField,
  TableData,
  makeIndent,
  makeTableName,
  qNameSplit,
  recase,
} from './types';
import { DialectOptions, FKSpec } from './dialects/dialect-options';

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
    extendMode?: 'base' | 'entity' | 'item';
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
      header +=
        "import { dateTimeRangeSearch, multipleSearch, TableColumnsParams } from '@/shares/components';\n";
      header +=
        "import { tableColumnsResult, transformStringToken, convertValueEnum } from '@/shares/components';\n";
      header +=
        "import type { UltraColumnType } from '@/shares/components';\n\n";
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
        str += `export function gen#TABLE#Columns(params?: TableColumnsParams): UltraColumnType<#TABLE#>[] {\n`;
        str +=
          'const columns: UltraColumnType<#TABLE#>[] = [\n';
        str += this.addFormColumns(table, true);
        str += ']\n';
        str += `  return tableColumnsResult(columns, params);\n`;
        str += '}\n\n';
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
          !this.isDeprecated(table, field) ||
          // && !this.isJSONField(table, field)
          this.isUid(field)
        ) {
          const name = this.quoteName(recase(this.options.caseProp, field));
          const isOptional = this.getTypeScriptFieldOptional(table, field);
          // str += this.getFieldAnnotation(table, field);
          str += '  {\n';
          str += `    dataIndex: '${name}',\n`;
          str += this.getTitle(table, field);
          if (field === 'state_code') {
            str += `    valueType: 'stateMachine',\n`;
            str += `    fieldProps: { bizmetaKey: 'internal/#TABLE#'},\n`;
            str += `    sorter: true,\n`;
          }

          if (field.startsWith('is')) {
            str += `    valueType: 'select',\n`;
            str += `    valueEnum: { '1': { text: '1 | 是' }, '0': { text: '0 | 否' } } ,\n`;
          }

          if (field.indexOf('cuscd') > 0 || field.indexOf('portcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'chnCustoms'},\n`;
          }

          if (field.indexOf('modecd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: '${name}'},\n`;
          }

          if (field.indexOf('natcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'countryV1'},\n`;
          }

          if (field.indexOf('natcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'countryV1'},\n`;
          }
          if (field.indexOf('unitcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'unit'},\n`;
            // str += `    hideInSearch: true,\n`;
          }

          if (field.indexOf('currcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'currencyV1'},\n`;
            // str += `    hideInSearch: true,\n`;
          }

          if (
            field.indexOf('markcd') > 0 ||
            field.indexOf('typecd') > 0 ||
            field.indexOf('stucd') > 0
          ) {
            str += `    valueType: 'valueEnum',\n`;
            str += `    fieldProps: { valueOptionsKey: '${name}'},\n`;
          }

          if (field === 'created_by' || field === 'lastUpdated_by') {
            str += `    valueType: 'member',\n`;
          }
          if (field.indexOf('_no') > 0) {
            str += `    filterOp: '$like',\n`;
            str += `    search: multipleSearch,\n`;
          }
          str += this.getDateRangeSearch(table, field);
          // str += `    valueType: '${this.getFormValueType(table, field)}',\n`;
          str += this.getHideInTable(field);
          str += this.getHideInSearch(table, field);
          str += this.getHideInForm(field);
          if (this.isJSONField(table, field)) {
            str += `    hideInTable: true,\n`;
            str += `    showInFile: true\n`;
          }
          // str += '    ellipsis: true\n';
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
      const [title] = fieldObj.comment.split('#');
      return `    title: '${title}',\n`;
    }
    return '';
  }

  private getHideInTable(field: string) {
    if (
      /(uid)$/.test(field) ||
      ['warehouse_code', 'org_id', 'pid'].includes(field)
    ) {
      return '    hideInTable: true,\n';
    }
    return '';
    // return '    hideInSearch: true,\n';
  }

  private getHideInSearch(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    const rawFieldType = fieldObj['type'] || '';
    const fieldType = String(rawFieldType).toLowerCase();

    if (
      /(uid)$/.test(field) ||
      this.isJSON(fieldType) ||
      this.isNumber(fieldType) ||
      this.isBoolean(fieldType) ||
      [
        'warehouse_code',
        'org_id',
        'pid',
        'rmk',
        'channel_props',
        'resp_info',
      ].includes(field) ||
      field.indexOf('unitcd') > 0 ||
      field.indexOf('currcd') > 0
    ) {
      return '    hideInSearch: true,\n';
    }
    return '    hideInSearch: false,\n';
  }

  private getDateRangeSearch(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    const rawFieldType = fieldObj['type'] || '';
    const fieldType = String(rawFieldType).toLowerCase();

    if (this.isDate(fieldType)) {
      return "    valueType: 'dateRangeSearch',\nsearch: dateRangeSearch,\n";
    } else if (this.isDateTime(fieldType)) {
      return "    valueType: 'dateTimeRangeSearch',\nsearch: dateTimeRangeSearch,\n";
    }
    return '';
  }

  private getHideInForm(field: string) {
    if (
      [
        'uid',
        'createdBy',
        'createdDate',
        'lastUpdatedBy',
        'lastUpdatedDate',
      ].includes(recase('c', field)) ||
      /(uid)$/.test(field)
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
    if (this.options.extendMode === 'entity') {
      return ['id', 'tenantId'].includes(recase('c', field));
    }
    if (this.options.extendMode === 'item') {
      return ['id', 'tenantId', 'pid', 'localSid', 'ieFlag'].includes(
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
