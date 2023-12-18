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

import { ColumnDescription } from 'sequelize/types';
import _ from 'lodash';

/** Generates text from each table in TableData */
export class DorisGenerator {
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
    console.warn('tableData', tableData);
  }

  makeHeaderTemplate() {
    let header = '';
    const sp = this.space[1];

    // if (this.options.lang === 'ts') {
    //   header += `type ColumnsParams = {
    //     presetColumns?: { dataIndex: string; title: string; hideInTable: boolean; hideInSearch: boolean }[];
    //     valueEnums?: ValueEnums;
    //     cusParams?: CusParams;
    //     tableColumnKeys?: string[];
    //     searchColumnKeys?: string[];
    //   };\n\n`;
    // }
    return header;
  }

  generateText() {
    const tableNames = _.keys(this.tables);

    const header = this.makeHeaderTemplate();

    const text: { [name: string]: string } = {};
    tableNames.forEach(table => {
      let str = header;
      const [schemaName, tableNameOrig] = qNameSplit(table);
      // console.warn('table', table, schemaName, tableNameOrig);
      const tableName = tableNameOrig!;
      // const tableName = makeTableName(
      //   this.options.caseModel,
      //   tableNameOrig,
      //   this.options.singularize,
      //   this.options.lang
      // );

      str += 'DROP TABLE IF EXISTS `#TABLE#`;\n';
      str += 'CREATE TABLE `#TABLE#` (\n';
      str += "  `uid` VARCHAR(24) NOT NULL COMMENT 'UID',\n";
      str += "  `created_date` DATETIME NOT NULL COMMENT '创建时间',\n";
      str += "  `tenant_id` BIGINT(20) NOT NULL COMMENT '租户ID',\n";
      str += this.addFormColumns(table, true);
      str += ') ENGINE=OLAP\n';
      str += 'UNIQUE KEY(`uid`, `created_date`)\n';
      str += 'PARTITION BY RANGE(`created_date`) ()\n';
      str += 'DISTRIBUTED BY HASH(`uid`) BUCKETS 10\n';
      str += `PROPERTIES (
        "replication_allocation" = "tag.location.default: 3",
        "dynamic_partition.enable" = "true",
        "dynamic_partition.time_unit" = "MONTH",
        "dynamic_partition.time_zone" = "Asia/Shanghai",
        "dynamic_partition.start" = "-2147483648",
        "dynamic_partition.end" = "2",
        "dynamic_partition.prefix" = "p",
        "dynamic_partition.replication_allocation" = "tag.location.default: 3",
        "dynamic_partition.buckets" = "10",
        "dynamic_partition.create_history_partition" = "true",
        "dynamic_partition.history_partition_num" = "1",
        "dynamic_partition.hot_partition_num" = "0",
        "dynamic_partition.reserved_history_periods" = "NULL",
        "dynamic_partition.start_day_of_month" = "1",
        "in_memory" = "false",
        "storage_format" = "V2"
        );\n`;

      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName);

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
        const fieldObj = this.tables[table][field];
        console.warn('field', fieldObj);

        const rawFieldType = fieldObj.type;
        const fieldType = String(rawFieldType).toLowerCase();
        let type = rawFieldType;

        if (this.isVarchar(fieldType)) {
          const length = Number(fieldType.match(/\d+/)?.toString());
          // console.warn('length', length?.toString());
          if (length && length < 21844) {
            type = `VARCHAR(${Number(length?.toString()) * 3})`;
          }
        }
        if (this.isJSON(fieldType)) {
          type = 'JSONB';
        }
        if (rawFieldType.includes('UNSIGNED')) {
          type = rawFieldType.replace('UNSIGNED', '');
        }
        str += `  \`${field}\` ${type} ${
          fieldObj.allowNull ? 'NULL' : 'NOT NULL'
        } ${fieldObj.comment ? `COMMENT "${fieldObj.comment}"` : ''}`;
        // str += this.getFieldAnnotation(table, field);
        // str += '  {\n';
        // str += `    dataIndex: '${name}',\n`;
        // str += this.getTitle(table, field);
        // str += `    valueType: '${this.getFormValueType(table, field)}',\n`;
        // str += this.getHideInTable(field);
        // str += this.getHideInSearch(field, counter);
        // str += this.getHideInForm(field);
        // str += '    ellipsis: true\n';
        // str += '  },\n';
        if (counter < fields.length - 1) {
          str += ',\n';
        } else {
          str += '\n';
        }
      }
      counter++;
    });
    return str;
  }

  private isVarchar(fieldType: string): boolean {
    return /^(varchar)/.test(fieldType);
  }

  private getHideInTable(field: string) {
    if (/(uid)$/.test(field)) {
      return '    hideInTable: true,\n';
    }
    return '';
  }

  private getHideInSearch(field: string, counter: number) {
    // if (/(name|_no|_code)$/.test(field) && counter < 11) {
    //   return '    hideInSearch: false,\n';
    // }
    // return '    hideInSearch: true,\n';
    if (/(uid)$/.test(field)) {
      return '    hideInSearch: true,\n';
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
    // if (
    //   this.options.extendMode === 'entity' ||
    //   this.options.extendMode === 'vo'
    // ) {
    return ['uid', 'tenantId', 'createdDate'].includes(recase('c', field));
    // }
    // return this.options.skipFields && this.options.skipFields.includes(field);
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
