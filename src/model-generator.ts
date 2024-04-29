import _ from 'lodash';
import { ColumnDescription } from 'sequelize/types';
import { DialectOptions, FKSpec } from './dialects/dialect-options';
import {
  AutoOptions,
  CaseFileOption,
  CaseOption,
  Field,
  IndexSpec,
  LangOption,
  makeIndent,
  makeTableName,
  pluralize,
  qNameJoin,
  qNameSplit,
  recase,
  Relation,
  singularize,
  TableData,
  TSField,
} from './types';

/** Generates text from each table in TableData */
export class ModelGenerator {
  dialect: DialectOptions;
  tables: { [tableName: string]: { [fieldName: string]: ColumnDescription } };
  foreignKeys: { [tableName: string]: { [fieldName: string]: FKSpec } };
  hasTriggerTables: { [tableName: string]: boolean };
  indexes: { [tableName: string]: IndexSpec[] };
  relations: Relation[];
  space: string[];
  options: AutoOptions & {
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
    this.foreignKeys = tableData.foreignKeys;
    this.hasTriggerTables = tableData.hasTriggerTables;
    this.indexes = tableData.indexes;
    this.relations = tableData.relations;
    this.dialect = dialect;
    this.options = options;
    this.options.lang = this.options.lang || 'es5';
    this.space = makeIndent(this.options.spaces, this.options.indentation);
  }

  makeHeaderTemplate() {
    let header = '';
    const sp = this.space[1];

    if (this.options.lang === 'ts') {
      header += '/* eslint-disable node/no-extraneous-import */\n';
      header +=
        this.options.extendMode === 'entity'
          ? "import { Column, BeforeCreate, BeforeBulkCreate, Table } from 'sequelize-typescript';\n"
          : "import { Column, Table } from 'sequelize-typescript';\n";
      header += "import { DataTypes } from 'sequelize';\n";
      header += "import { #MODEL# } from '@midwayjs-plus/common';\n";
      if (this.options.extendMode === 'entity') {
        header += "import { nanoid } from 'nanoid';\n";
      }
    } else {
      header += "const Sequelize = require('sequelize');\n";
      header += 'module.exports = function(sequelize, DataTypes) {\n';
      header += sp + "return sequelize.define('#TABLE#', {\n";
    }
    return header;
  }

  generateText() {
    const tableNames = _.keys(this.tables);

    const header = this.makeHeaderTemplate();

    const text: { [name: string]: string } = {};
    tableNames.forEach(table => {
      let str = header;
      // console.warn('@@@@@@@@@@@@@', this.tables[table])
      const [schemaName, tableNameOrig] = qNameSplit(table);
      const tableName = makeTableName(
        this.options.caseModel,
        tableNameOrig,
        this.options.singularize,
        this.options.lang
      );

      if (this.options.lang === 'ts') {
        const associations = this.addTypeScriptAssociationMixins(table);
        const needed = _.keys(associations.needed).sort();
        needed.forEach(fkTable => {
          const set = associations.needed[fkTable];
          const [fkSchema, fkTableName] = qNameSplit(fkTable);
          const filename = recase(
            this.options.caseFile,
            fkTableName,
            this.options.singularize
          );
          str += 'import type { ';
          str += Array.from(set.values()).sort().join(', ');
          str += ` } from './${filename}';\n`;
        });

        // str += "\nexport interface #TABLE#Attributes {\n";
        // str += this.addTypeScriptFields(table, true) + "}\n\n";

        const primaryKeys = this.getTypeScriptPrimaryKeys(table);

        // if (primaryKeys.length) {
        //   str += `export type #TABLE#Pk = ${primaryKeys.map((k) => `"${recase(this.options.caseProp, k)}"`).join(' | ')};\n`;
        //   str += `export type #TABLE#Id = #TABLE#[#TABLE#Pk];\n`;
        // }

        const creationOptionalFields =
          this.getTypeScriptCreationOptionalFields(table);

        // if (creationOptionalFields.length) {
        //   str += `export type #TABLE#OptionalAttributes = ${creationOptionalFields.map((k) => `"${recase(this.options.caseProp, k)}"`).join(' | ')};\n`;
        //   str += "export type #TABLE#CreationAttributes = Optional<#TABLE#Attributes, #TABLE#OptionalAttributes>;\n\n";
        // } else {
        //   str += "export type #TABLE#CreationAttributes = #TABLE#Attributes;\n\n";
        // }

        // str += "export class #TABLE# extends Model {\n";
        // str += "export class #TABLE# extends Model<#TABLE#Attributes, #TABLE#CreationAttributes> implements #TABLE#Attributes {\n";
        // str += this.addTypeScriptFields(table, false);
        // str += "\n" + associations.str;
        // str += "\n" + this.space[1] + "static initModel(sequelize: Sequelize.Sequelize): typeof #TABLE# {\n";

        // if (this.options.useDefine) {
        //   str += this.space[2] + "return sequelize.define('#TABLE#', {\n";

        // } else {
        //   str += this.space[2] + "return #TABLE#.init({\n";
        // }
      }

      str += this.addTable(table);

      if (this.options.extendMode === 'entity' && !this.options.views) {
        str += 'static PREFIX = _PREFIX_;\n\n';

        str += '@BeforeCreate\n';
        str += 'static addUid(instance: #TABLE#Model) {\n';
        str += 'if (!instance.uid) {\n';
        str += 'instance.uid = `${#TABLE#Model.PREFIX}${nanoid()}`;\n';
        str += '}\n}\n\n';

        str += '@BeforeBulkCreate\n';
        str += 'static addUids(instances: #TABLE#Model[]) {\n';
        str += 'instances.forEach(instance => {\n';
        str += 'if (!instance.uid) {\n';
        str += 'instance.uid = `${#TABLE#Model.PREFIX}${nanoid()}`;\n';
        str += '}\n});\n';
        str += '}\n\n';
      }

      str += '}\n';

      const re = new RegExp('#TABLE#', 'g');
      str = str.replace(re, tableName.slice(this.options.omitPrefix));

      const mre = new RegExp('#MODEL#', 'g');
      let modelName = 'BaseModel';
      if (this.options.extendMode === 'entity') {
        modelName = 'BaseEntityModel';
      } else if (this.options.extendMode === 'vo') {
        modelName = 'BaseValueObjectModel';
      }
      str = str.replace(mre, modelName);

      text[table] = str;
    });

    return text;
  }

  // Create a string for the model of the table
  private addTable(table: string) {
    const [schemaName, tableNameOrig] = qNameSplit(table);
    const space = this.space;
    let timestamps =
      (this.options.additional &&
        this.options.additional.timestamps === true) ||
      false;
    let paranoid =
      (this.options.additional && this.options.additional.paranoid === true) ||
      false;

    let str = '';

    // trim off last ",\n"
    //str = str.substring(0, str.length - 2) + "\n";

    // add the table options
    // str += space[1] + "}, {\n";
    // if (!this.options.useDefine) {
    //   str += space[2] + "sequelize,\n";
    // }
    str += "@Table({ tableName: '" + tableNameOrig + "',\n";

    if (schemaName && this.dialect.hasSchema) {
      str += space[2] + "schema: '" + schemaName + "',\n";
    }

    if (this.hasTriggerTables[table]) {
      str += space[2] + 'hasTrigger: true,\n';
    }

    str += space[2] + 'timestamps: ' + timestamps + ',\n';
    if (paranoid) {
      str += space[2] + 'paranoid: true,\n';
    }

    // conditionally add additional options
    const hasadditional =
      _.isObject(this.options.additional) &&
      _.keys(this.options.additional).length > 0;
    if (hasadditional) {
      _.each(this.options.additional, (value, key) => {
        if (key === 'name') {
          // name: true - preserve table name always
          str += space[2] + 'name: {\n';
          str += space[3] + "singular: '" + table + "',\n";
          str += space[3] + "plural: '" + table + "'\n";
          str += space[2] + '},\n';
        } else if (key === 'timestamps' || key === 'paranoid') {
          // handled above
        } else {
          value = _.isBoolean(value) ? value : "'" + value + "'";
          str += space[2] + key + ': ' + value + ',\n';
        }
      });
    }

    // add indexes
    // if (!this.options.noIndexes) {
    str += this.addIndexes(table);
    // }

    str = space[2] + str.trim();
    str = str.substring(0, str.length - 1);
    str += '\n' + space[1] + '})\n';

    str += 'export class #TABLE#Model extends #MODEL# {\n';

    // add all the fields
    const fields = _.keys(this.tables[table]);
    fields.forEach((field, index) => {
      timestamps ||= this.isTimestampField(field);
      paranoid ||= this.isParanoidField(field);

      str += this.addField(table, field);
    });

    return str;
  }

  // Create a string containing field attributes (type, defaultValue, etc.)
  private addField(table: string, field: string): string {
    // ignore Sequelize standard fields
    const additional = this.options.additional;
    if (
      additional &&
      additional.timestamps !== false &&
      (this.isTimestampField(field) || this.isParanoidField(field))
    ) {
      return '';
    }

    if (this.isIgnoredField(field)) {
      return '';
    }

    // Find foreign key
    const foreignKey =
      this.foreignKeys[table] && this.foreignKeys[table][field]
        ? this.foreignKeys[table][field]
        : null;
    const fieldObj = this.tables[table][field] as Field;

    if (_.isObject(foreignKey)) {
      fieldObj.foreignKey = foreignKey;
    }

    const fieldName = recase(this.options.caseProp, field);
    let str = '@Column({\n';

    const quoteWrapper = '"';

    const unique =
      fieldObj.unique || (fieldObj.foreignKey && fieldObj.foreignKey.isUnique);

    const isSerialKey =
      (fieldObj.foreignKey && fieldObj.foreignKey.isSerialKey) ||
      (this.dialect.isSerialKey && this.dialect.isSerialKey(fieldObj));

    let wroteAutoIncrement = false;
    const space = this.space;

    let isDeprecatedField;
    // column's attributes
    const fieldAttrs = _.keys(fieldObj);
    fieldAttrs.forEach(attr => {
      // We don't need the special attribute from postgresql; "unique" is handled separately
      if (attr === 'special' || attr === 'elementType' || attr === 'unique') {
        return true;
      }

      if (isSerialKey && !wroteAutoIncrement) {
        str += space[3] + 'autoIncrement: true,\n';
        // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
        if (
          this.dialect.name === 'postgres' &&
          fieldObj.foreignKey &&
          fieldObj.foreignKey.isPrimaryKey === true &&
          (fieldObj.foreignKey.generation === 'ALWAYS' ||
            fieldObj.foreignKey.generation === 'BY DEFAULT')
        ) {
          str += space[3] + 'autoIncrementIdentity: true,\n';
        }
        wroteAutoIncrement = true;
      }

      if (attr === 'foreignKey') {
        if (foreignKey && foreignKey.isForeignKey) {
          str += space[3] + 'references: {\n';
          str +=
            space[4] +
            "model: '" +
            fieldObj[attr].foreignSources.target_table +
            "',\n";
          str +=
            space[4] +
            "key: '" +
            fieldObj[attr].foreignSources.target_column +
            "'\n";
          str += space[3] + '}';
        } else {
          return true;
        }
      } else if (attr === 'references') {
        // covered by foreignKey
        return true;
      } else if (attr === 'primaryKey') {
        if (
          fieldObj[attr] === true &&
          (!_.has(fieldObj, 'foreignKey') || !!fieldObj.foreignKey.isPrimaryKey)
        ) {
          str += space[3] + 'primaryKey: true';
        } else {
          return true;
        }
      } else if (attr === 'autoIncrement') {
        if (fieldObj[attr] === true && !wroteAutoIncrement) {
          str += space[3] + 'autoIncrement: true,\n';
          // Resort to Postgres' GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
          if (
            this.dialect.name === 'postgres' &&
            fieldObj.foreignKey &&
            fieldObj.foreignKey.isPrimaryKey === true &&
            (fieldObj.foreignKey.generation === 'ALWAYS' ||
              fieldObj.foreignKey.generation === 'BY DEFAULT')
          ) {
            str += space[3] + 'autoIncrementIdentity: true,\n';
          }
          wroteAutoIncrement = true;
        }
        return true;
      } else if (attr === 'allowNull') {
        // str += space[3] + attr + ": " + fieldObj[attr];
        if (fieldObj[attr] === true) {
          return true;
        }
        str += space[3] + attr + ': ' + fieldObj[attr];
      } else if (attr === 'defaultValue') {
        // console.warn('defaultValue', fieldObj[attr]);
        if (fieldObj[attr] === null) {
          return true;
        } else if (fieldObj[attr] === '') {
          str += space[3] + attr + ': ' + quoteWrapper + quoteWrapper;
        } else {
          str += space[3] + attr + ': ' + fieldObj[attr];
        }
      } else if (attr === 'comment') {
        let val = fieldObj[attr];
        if (!val) {
          return true;
        }
        if (val.startsWith('~')) {
          isDeprecatedField = true;
          return true;
        }
        val = val.split('#')[0];
        val = _.isString(val)
          ? quoteWrapper + this.escapeSpecial(val) + quoteWrapper
          : val;
        str += space[3] + attr + ': ' + val;
      } else {
        let val = attr !== 'type' ? null : this.getSqType(fieldObj, attr);
        if (val == null) {
          val = (fieldObj as any)[attr];
          val = _.isString(val)
            ? quoteWrapper + this.escapeSpecial(val) + quoteWrapper
            : val;
        }
        str += space[3] + attr + ': ' + val;
      }

      str += ',\n';
    });

    if (isDeprecatedField) {
      return '';
    }

    if (unique) {
      const uniq = _.isString(unique)
        ? quoteWrapper + unique.replace(/\"/g, '\\"') + quoteWrapper
        : unique;
      str += space[3] + 'unique: ' + uniq + ',\n';
    }

    // if (field !== fieldName) {
    //   str += space[3] + "field: '" + field + "',\n";
    // }

    // removes the last `,` within the attribute options
    // str = str.trim().replace(/,+$/, '') + "\n";
    str = space[2] + str + space[2] + '})\n';
    str +=
      space[2] +
      this.quoteName(fieldName) +
      ': ' +
      this.getTypeScriptType(table, field) +
      ';\n\n';
    return str;
  }

  private addIndexes(table: string) {
    const indexes = this.indexes[table];
    const space = this.space;
    let str = '';
    if (indexes && indexes.length) {
      str += space[2] + 'indexes: [\n';
      indexes.forEach(idx => {
        if (!idx.primary) {
          str += space[3] + '{\n';
          if (idx.name) {
            str += space[4] + `name: "${idx.name}",\n`;
          }
          if (idx.unique) {
            str += space[4] + 'unique: true,\n';
          }
          if (idx.type) {
            if (['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(idx.type)) {
              str += space[4] + `type: "${idx.type}",\n`;
            } else {
              str += space[4] + `using: "${idx.type}",\n`;
            }
          }
          str += space[4] + `fields: [\n`;
          idx.fields.forEach(ff => {
            str += space[5] + `{ name: "${ff.attribute}"`;
            if (ff.collate) {
              str += `, collate: "${ff.collate}"`;
            }
            if (ff.length) {
              str += `, length: ${ff.length}`;
            }
            if (ff.order && ff.order !== 'ASC') {
              str += `, order: "${ff.order}"`;
            }
            str += ' },\n';
          });
          str += space[4] + ']\n';
          str += space[3] + '},\n';
        }
      });
      str += space[2] + '],\n';
    }
    return str;
  }

  /** Get the sequelize type from the Field */
  private getSqType(fieldObj: Field, attr: string): string {
    const attrValue = (fieldObj as any)[attr];
    if (!attrValue.toLowerCase) {
      // console.log('attrValue', attr, attrValue);
      return attrValue;
    }
    const type: string = attrValue.toLowerCase();
    const length = type.match(/\(\d+\)/);
    const precision = type.match(/\(\d+,\d+\)/);
    let val = null;
    let typematch = null;

    if (type === 'tinyint(1)') {
      val = 'DataTypes.TINYINT({ length: 1 })';
    } else if (
      type === 'boolean' ||
      type === 'bit(1)' ||
      type === 'bit' ||
      type === 'tinyint(1) unsigned'
    ) {
      val = 'DataTypes.BOOLEAN';

      // postgres range types
    } else if (type === 'numrange') {
      val = 'DataTypes.RANGE(DataTypes.DECIMAL)';
    } else if (type === 'int4range') {
      val = 'DataTypes.RANGE(DataTypes.INTEGER)';
    } else if (type === 'int8range') {
      val = 'DataTypes.RANGE(DataTypes.BIGINT)';
    } else if (type === 'daterange') {
      val = 'DataTypes.RANGE(DataTypes.DATEONLY)';
    } else if (type === 'tsrange' || type === 'tstzrange') {
      val = 'DataTypes.RANGE(DataTypes.DATE)';
    } else if (
      (typematch = type.match(/^(bigint|smallint|mediumint|tinyint|int)/))
    ) {
      // integer subtypes
      val =
        'DataTypes.' +
        (typematch[0] === 'int' ? 'INTEGER' : typematch[0].toUpperCase());
      if (/unsigned/i.test(type)) {
        val += '.UNSIGNED';
      }
      if (/zerofill/i.test(type)) {
        val += '.ZEROFILL';
      }
    } else if (type === 'nvarchar(max)' || type === 'varchar(max)') {
      val = 'DataTypes.TEXT';
    } else if (type.match(/n?varchar|string|varying/)) {
      val = 'DataTypes.STRING' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^n?char/)) {
      val = 'DataTypes.CHAR' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^real/)) {
      val = 'DataTypes.REAL';
    } else if (type.match(/text$/)) {
      val = 'DataTypes.TEXT' + (!_.isNull(length) ? length : '');
    } else if (type === 'date') {
      val = 'DataTypes.DATEONLY';
    } else if (type.match(/^(date|timestamp|year)/)) {
      val = 'DataTypes.DATE' + (!_.isNull(length) ? length : '');
    } else if (type.match(/^(time)/)) {
      val = 'DataTypes.TIME';
    } else if (type.match(/^(float|float4)/)) {
      val = 'DataTypes.FLOAT' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^(decimal|numeric)/)) {
      val = 'DataTypes.DECIMAL' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^money/)) {
      val = 'DataTypes.DECIMAL(19,4)';
    } else if (type.match(/^smallmoney/)) {
      val = 'DataTypes.DECIMAL(10,4)';
    } else if (type.match(/^(float8|double)/)) {
      val = 'DataTypes.DOUBLE' + (!_.isNull(precision) ? precision : '');
    } else if (type.match(/^uuid|uniqueidentifier/)) {
      val = 'DataTypes.UUID';
    } else if (type.match(/^jsonb/)) {
      val = 'DataTypes.JSONB';
    } else if (type.match(/^json/)) {
      val = 'DataTypes.JSON';
    } else if (type.match(/^geometry/)) {
      const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
      val = `DataTypes.GEOMETRY${gtype}`;
    } else if (type.match(/^geography/)) {
      const gtype = fieldObj.elementType ? `(${fieldObj.elementType})` : '';
      val = `DataTypes.GEOGRAPHY${gtype}`;
    } else if (type.match(/^array/)) {
      const eltype = this.getSqType(fieldObj, 'elementType');
      val = `DataTypes.ARRAY(${eltype})`;
    } else if (type.match(/(binary|image|blob|bytea)/)) {
      val = 'DataTypes.BLOB';
    } else if (type.match(/^hstore/)) {
      val = 'DataTypes.HSTORE';
    } else if (type.match(/^inet/)) {
      val = 'DataTypes.INET';
    } else if (type.match(/^cidr/)) {
      val = 'DataTypes.CIDR';
    } else if (type.match(/^oid/)) {
      val = 'DataTypes.INTEGER';
    } else if (type.match(/^macaddr/)) {
      val = 'DataTypes.MACADDR';
    } else if (type.match(/^enum(\(.*\))?$/)) {
      const enumValues = this.getEnumValues(fieldObj);
      val = `DataTypes.ENUM(${enumValues})`;
    }

    return val as string;
  }

  private getTypeScriptPrimaryKeys(table: string): Array<string> {
    const fields = _.keys(this.tables[table]);
    return fields.filter((field): boolean => {
      const fieldObj = this.tables[table][field];
      return fieldObj['primaryKey'];
    });
  }

  private getTypeScriptCreationOptionalFields(table: string): Array<string> {
    const fields = _.keys(this.tables[table]);
    return fields.filter((field): boolean => {
      const fieldObj = this.tables[table][field];
      return (
        fieldObj.allowNull ||
        !!fieldObj.defaultValue ||
        fieldObj.defaultValue === '' ||
        fieldObj.autoIncrement ||
        this.isTimestampField(field)
      );
    });
  }

  /** Add schema to table so it will match the relation data.  Fixes mysql problem. */
  private addSchemaForRelations(table: string) {
    if (
      !table.includes('.') &&
      !this.relations.some(rel => rel.childTable === table)
    ) {
      // if no tables match the given table, then assume we need to fix the schema
      const first = this.relations.find(rel => !!rel.childTable);
      if (first) {
        const [schemaName, tableName] = qNameSplit(first.childTable);
        if (schemaName) {
          table = qNameJoin(schemaName, table);
        }
      }
    }
    return table;
  }

  private addTypeScriptAssociationMixins(table: string): Record<string, any> {
    const sp = this.space[1];
    const needed: Record<string, Set<String>> = {};
    let str = '';

    table = this.addSchemaForRelations(table);

    this.relations.forEach(rel => {
      if (!rel.isM2M) {
        if (rel.childTable === table) {
          // current table is a child that belongsTo parent
          const pparent = _.upperFirst(rel.parentProp);
          str += `${sp}// ${rel.childModel} belongsTo ${rel.parentModel} via ${rel.parentId}\n`;
          str += `${sp}${rel.parentProp}!: ${rel.parentModel};\n`;
          str += `${sp}get${pparent}!: Sequelize.BelongsToGetAssociationMixin<${rel.parentModel}>;\n`;
          str += `${sp}set${pparent}!: Sequelize.BelongsToSetAssociationMixin<${rel.parentModel}, ${rel.parentModel}Id>;\n`;
          str += `${sp}create${pparent}!: Sequelize.BelongsToCreateAssociationMixin<${rel.parentModel}>;\n`;
          needed[rel.parentTable] ??= new Set();
          needed[rel.parentTable].add(rel.parentModel);
          needed[rel.parentTable].add(rel.parentModel + 'Id');
        } else if (rel.parentTable === table) {
          needed[rel.childTable] ??= new Set();
          const pchild = _.upperFirst(rel.childProp);
          if (rel.isOne) {
            // const hasModelSingular = singularize(hasModel);
            str += `${sp}// ${rel.parentModel} hasOne ${rel.childModel} via ${rel.parentId}\n`;
            str += `${sp}${rel.childProp}!: ${rel.childModel};\n`;
            str += `${sp}get${pchild}!: Sequelize.HasOneGetAssociationMixin<${rel.childModel}>;\n`;
            str += `${sp}set${pchild}!: Sequelize.HasOneSetAssociationMixin<${rel.childModel}, ${rel.childModel}Id>;\n`;
            str += `${sp}create${pchild}!: Sequelize.HasOneCreateAssociationMixin<${rel.childModel}>;\n`;
            needed[rel.childTable].add(rel.childModel);
            needed[rel.childTable].add(`${rel.childModel}Id`);
            needed[rel.childTable].add(`${rel.childModel}CreationAttributes`);
          } else {
            const hasModel = rel.childModel;
            const sing = _.upperFirst(singularize(rel.childProp));
            const lur = pluralize(rel.childProp);
            const plur = _.upperFirst(lur);
            str += `${sp}// ${rel.parentModel} hasMany ${rel.childModel} via ${rel.parentId}\n`;
            str += `${sp}${lur}!: ${rel.childModel}[];\n`;
            str += `${sp}get${plur}!: Sequelize.HasManyGetAssociationsMixin<${hasModel}>;\n`;
            str += `${sp}set${plur}!: Sequelize.HasManySetAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}add${sing}!: Sequelize.HasManyAddAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}add${plur}!: Sequelize.HasManyAddAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}create${sing}!: Sequelize.HasManyCreateAssociationMixin<${hasModel}>;\n`;
            str += `${sp}remove${sing}!: Sequelize.HasManyRemoveAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}remove${plur}!: Sequelize.HasManyRemoveAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}has${sing}!: Sequelize.HasManyHasAssociationMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}has${plur}!: Sequelize.HasManyHasAssociationsMixin<${hasModel}, ${hasModel}Id>;\n`;
            str += `${sp}count${plur}!: Sequelize.HasManyCountAssociationsMixin;\n`;
            needed[rel.childTable].add(hasModel);
            needed[rel.childTable].add(`${hasModel}Id`);
          }
        }
      } else {
        // rel.isM2M
        if (rel.parentTable === table) {
          // many-to-many
          const isParent = rel.parentTable === table;
          const thisModel = isParent ? rel.parentModel : rel.childModel;
          const otherModel = isParent ? rel.childModel : rel.parentModel;
          const otherModelSingular = _.upperFirst(
            singularize(isParent ? rel.childProp : rel.parentProp)
          );
          const lotherModelPlural = pluralize(
            isParent ? rel.childProp : rel.parentProp
          );
          const otherModelPlural = _.upperFirst(lotherModelPlural);
          const otherTable = isParent ? rel.childTable : rel.parentTable;
          str += `${sp}// ${thisModel} belongsToMany ${otherModel} via ${rel.parentId} and ${rel.childId}\n`;
          str += `${sp}${lotherModelPlural}!: ${otherModel}[];\n`;
          str += `${sp}get${otherModelPlural}!: Sequelize.BelongsToManyGetAssociationsMixin<${otherModel}>;\n`;
          str += `${sp}set${otherModelPlural}!: Sequelize.BelongsToManySetAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}add${otherModelSingular}!: Sequelize.BelongsToManyAddAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}add${otherModelPlural}!: Sequelize.BelongsToManyAddAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}create${otherModelSingular}!: Sequelize.BelongsToManyCreateAssociationMixin<${otherModel}>;\n`;
          str += `${sp}remove${otherModelSingular}!: Sequelize.BelongsToManyRemoveAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}remove${otherModelPlural}!: Sequelize.BelongsToManyRemoveAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}has${otherModelSingular}!: Sequelize.BelongsToManyHasAssociationMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}has${otherModelPlural}!: Sequelize.BelongsToManyHasAssociationsMixin<${otherModel}, ${otherModel}Id>;\n`;
          str += `${sp}count${otherModelPlural}!: Sequelize.BelongsToManyCountAssociationsMixin;\n`;
          needed[otherTable] ??= new Set();
          needed[otherTable].add(otherModel);
          needed[otherTable].add(`${otherModel}Id`);
        }
      }
    });
    if (needed[table]) {
      delete needed[table]; // don't add import for self
    }
    return { needed, str };
  }

  private addTypeScriptFields(table: string, isInterface: boolean) {
    const sp = this.space[1];
    const fields = _.keys(this.tables[table]);
    const notNull = isInterface ? '' : '!';
    let str = '';
    fields.forEach(field => {
      if (
        !this.options.skipFields ||
        !this.options.skipFields.includes(field)
      ) {
        const name = this.quoteName(recase(this.options.caseProp, field));
        const isOptional = this.getTypeScriptFieldOptional(table, field);
        str += `${sp}${name}${
          isOptional ? '?' : notNull
        }: ${this.getTypeScriptType(table, field)};\n`;
      }
    });
    return str;
  }

  private getTypeScriptFieldOptional(table: string, field: string) {
    const fieldObj = this.tables[table][field];
    return fieldObj.allowNull;
  }

  private getTypeScriptType(table: string, field: string) {
    const fieldObj = this.tables[table][field] as TSField;
    return this.getTypeScriptFieldType(fieldObj, 'type');
  }

  private getTypeScriptFieldType(fieldObj: TSField, attr: keyof TSField) {
    const rawFieldType = fieldObj[attr] || '';
    const fieldType = String(rawFieldType).toLowerCase();
    // console.log(fieldType);

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
      return [
        'id',
        'uid',
        'tenantId',
        'createdBy',
        'createdDate',
        'lastUpdatedBy',
        'lastUpdatedDate',
      ].includes(recase('c', field));
    }
    return this.options.skipFields && this.options.skipFields.includes(field);
  }

  private escapeSpecial(val: string) {
    if (typeof val !== 'string') {
      return val;
    }
    return (
      val
        .replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\"')
        // .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t')
    );
  }

  /** Quote the name if it is not a valid identifier */
  private quoteName(name: string) {
    return /^[$A-Z_][0-9A-Z_$]*$/i.test(name) ? name : "'" + name + "'";
  }

  private isNumber(fieldType: string): boolean {
    return /^(smallint|mediumint|tinyint|int|bigint|float|money|smallmoney|double|decimal|numeric|real|oid)/.test(
      fieldType
    );
  }

  private isBoolean(fieldType: string): boolean {
    return (
      /^(boolean|bit)/.test(fieldType) || fieldType === 'tinyint(1) unsigned'
    );
  }

  private isDate(fieldType: string): boolean {
    return /^(datetime|timestamp)/.test(fieldType);
  }

  private isString(fieldType: string): boolean {
    return /^(char|nchar|string|varying|varchar|nvarchar|text|longtext|mediumtext|tinytext|ntext|uuid|uniqueidentifier|date|time|inet|cidr|macaddr)/.test(
      fieldType
    );
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
}
