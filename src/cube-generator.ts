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
export class CubeGenerator {
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
      // const tableName = tableNameOrig!;
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      str += 'cubes:\n';
      str += '  - name: #TABLE#\n';
      str += '    sql: >\n';
      str += '      SELECT *\n';
      str += `      FROM ${tableNameOrig}\n`;
      str +=
        '      WHERE tenant_id = {COMPILE_CONTEXT.securityContext.tenantId}\n';
      str += '    joins: []\n';
      str += '    dimensions:\n';
      str += this.addDimensionColumns(table, true);
      // str += ') ENGINE=OLAP\n';

      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName.slice(this.options.omitPrefix));

      text[table] = str;
    });

    return text;
  }

  private addDimensionColumns(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    const notNull = isInterface ? '' : '!';
    let str = '';
    let counter = 0;
    fields.forEach(field => {
      if (!this.isIgnoredField(field)) {
        const fieldObj = this.tables[table][field] as TSField;
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
          type = 'STRING';
        }
        if (rawFieldType.includes('UNSIGNED')) {
          type = rawFieldType.replace('UNSIGNED', '');
        }
        str += `      - name: ${recase('c', field)}\n`;
        str += `        sql: ${field}\n`;
        str += `        type: ${this.getTypeScriptFieldType(
          fieldObj,
          'type'
        )}\n`;
        if (field === 'uid') {
          str += `        primaryKey: true\n`;
          fieldObj.comment = 'UID主键';
        }
        if (field === 'created_date') {
          fieldObj.comment = '创建时间';
        }
        if (field === 'last_updated_date') {
          fieldObj.comment = '最后更新时间';
        }
        if (fieldObj.comment) {
          str += `        title: ${fieldObj.comment.replace('~', '')}\n`;
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

    if (this.isBoolean(fieldType)) {
      jsType = 'number';
    } else if (this.isNumber(fieldType)) {
      jsType = 'number';
    } else if (this.isDate(fieldType)) {
      jsType = 'time';
    } else if (this.isDateTime(fieldType)) {
      jsType = 'time';
      // } else if (this.isString(fieldType)) {
      //   jsType = 'string';
      // } else if (this.isEnum(fieldType)) {
      //   const values = this.getEnumValues(fieldObj);
      //   jsType = values.join(' | ');
      // } else if (this.isJSON(fieldType)) {
      //   jsType = 'string';
    } else {
      console.log(`Missing TypeScript type: ${fieldType || fieldObj['type']}`);
      jsType = 'string';
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
    return ['id', 'tenantId'].includes(recase('c', field));
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
