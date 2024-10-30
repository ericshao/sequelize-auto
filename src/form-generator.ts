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
export class FormGenerator {
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
    extendMode?: 'base' | 'entity' | 'item' | 'vo';
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
      header += "import { AccessType } from '@/access';\n";
      header += `import {
          colProps,
          decimalFieldProps,
          FormColumnsParams,
          integerFieldProps,
          metaCollapsibleProps,
          ValueTypeMapKey,
        } from '@/shares/components/schema-components';\n`;
      header +=
        "import { formColumnsResult } from '@/shares/components/schema-components/util';\n";
      header +=
        "import { ProFormColumnsType } from '@/shares/components/SchemaForm';\n";
      // header +=
      //   "import { convertToNumber, convertToString } from '@/utils';\n\n";
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
        str += `export function gen#TABLE#FormColumns(params?: FormColumnsParams, access?: AccessType): ProFormColumnsType<#TABLE#, ValueTypeMapKey>[]  {\n`;
        str +=
          'const columns: ProFormColumnsType<#TABLE#, ValueTypeMapKey>[] = [\n';
        str += this.addFormColumns(table, true);
        str += ']\n';
        str += `return formColumnsResult(columns, params);\n`;

        str += '}\n';
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

  private addFormColumns(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    const notNull = isInterface ? '' : '!';
    let str = '';
    fields.forEach(field => {
      if (!this.isIgnoredField(field) && !this.isTimestampField(field)) {
        if (!this.isDeprecated(table, field)) {
          const name = this.quoteName(recase(this.options.caseProp, field));
          const isOptional = this.getTypeScriptFieldOptional(table, field);
          // str += this.getFieldAnnotation(table, field);

          if (name.indexOf('EtpsSccd') > 0) {
            str +=  `{
          dataIndex: '${name}',
          placeholder: '社会信用编码',
          colProps: { ...colProps, xl: 8 },
          renderFormItem: (item, { defaultRender, ...rest }, form) => {
            return <DomesticPartySelect form={form} partyType="bizopEtps" valueOptionsKey="sccCode" />;
          },
        },`;
        return;
          }
          if (name.indexOf('EtpsNo') > 0 || name.indexOf('Etpsno') > 0) {
            str +=   `{
          dataIndex: '${name}',
          placeholder: '企业编号',
          valueType: 'text',
          colProps: { ...colProps, xl: 6 },
          formItemProps: {
            rules: [{ required: true }],
          },
          renderFormItem: (item, { defaultRender, ...rest }, form) => {
            return <DomesticPartySelect form={form} partyType="bizopEtps" valueOptionsKey="cusCode" />;
          },
        },`
        return;
          }
          if (name.indexOf('EtpsNm') > 0) {
            str +=   `{
          dataIndex: '${name}',
          placeholder: '企业名称',
          valueType: 'text',
          colProps: { ...colProps, xl: 10 },
          formItemProps: {
            rules: [{ required: true }],
          },
        },`;
        return;
          }



          str += '  {\n';
          str += `    dataIndex: '${name}',\n`;
          str += `    title: '${this.getFieldComment(table, field)}',\n`;

          if (field.indexOf('cuscd') > 0 || field.indexOf('portcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'chnCustoms'},\n`;
          } else if (field.indexOf('modecd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: '${name}'},\n`;
          } else if (field.indexOf('natcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'countryV1'},\n`;
          } else if (field.indexOf('natcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'countryV1'},\n`;
          } else if (field.indexOf('unitcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'unit'},\n`;
            str += `    hideInSearch: true,\n`;
          } else if (field.indexOf('currcd') > 0) {
            str += `    valueType: 'cusParam',\n`;
            str += `    fieldProps: { valueOptionsKey: 'currencyV1'},\n`;
            str += `    hideInSearch: true,\n`;
          } else if (
            field.indexOf('markcd') > 0 ||
            field.indexOf('typecd') > 0 ||
            field.indexOf('stucd') > 0
          ) {
            str += `    valueType: 'valueEnum',\n`;
            str += `    fieldProps: { valueOptionsKey: '${name}'},\n`;
          } else {
            str += `    valueType: '${this.getFormValueType(table, field)}',\n`;
          }
          if (this.isDecimalField(table, field)) {
            str += '    fieldProps: decimalFieldProps,\n';
          }
          if (this.isIntegerField(table, field)) {
            str += '    fieldProps: integerFieldProps,\n';
          }
          if (this.isUidField(field) || name.indexOf('GenFlag') > 0 || name.indexOf('Uids') > 0) {
            str += '    hideInForm: true,\n';
          }
          str += '    colProps,\n';
          str += '  },\n';
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
    return (
      this.tables[table][field].comment &&
      this.tables[table][field].comment?.startsWith('~')
    );
  }

  private getFieldComment(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;

    return fieldObj.comment;
  }

  private getFormValueType(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    return this.getTypeScriptFieldType(fieldObj, 'type');
  }

  private isDecimalField(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    const rawFieldType = fieldObj['type'] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    return /^(float|money|smallmoney|double|decimal)/.test(fieldType);
  }

  private isIntegerField(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    const rawFieldType = fieldObj['type'] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    return /^(smallint|mediumint|tinyint|int|bigint)/.test(fieldType);
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
    if (
      this.options.extendMode === 'entity' ||
      this.options.extendMode === 'item'
    ) {
      return [
        'id',
        'uid',
        'pid',
        'tenantId',
        'createdBy',
        'createdDate',
        'lastUpdatedBy',
        'lastUpdatedDate',
        'warehouseCode',
        'localSid',
        'orgId',
        'respInfo',
        'channelProps',
        'chnUid',
        ,
        'stateCode',
        'ieFlag',
      ].includes(recase('c', field));
    }
    return this.options.skipFields && this.options.skipFields.includes(field);
  }

  private isUidField(field: string) {
    if (
      this.options.extendMode === 'entity' ||
      this.options.extendMode === 'item'
    ) {
      return /(uid)$/.test(field);
    }
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
    return /^(date|datetime|timestamp)/.test(fieldType);
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
