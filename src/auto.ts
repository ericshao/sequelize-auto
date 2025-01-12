import _ from 'lodash';
import { Dialect, Sequelize } from 'sequelize';
import { AutoBuilder } from './auto-builder';
import { ModelGenerator } from './model-generator';
import { DtoGenerator } from './dto-generator';
import { TypeGenerator } from './type-generator';
import { AutoRelater } from './auto-relater';
import { AutoWriter } from './auto-writer';
import { dialects } from './dialects/dialects';
import { AutoOptions, TableData } from './types';
import { FormGenerator } from './form-generator';
import { ColumnGenerator } from './column-generator';
// import { DorisGenerator } from './doris-generator';
// import { CubeGenerator } from './cube-generator';
import { ViewGenerator } from './view-generator';

export class SequelizeAuto {
  sequelize: Sequelize;
  options: AutoOptions;

  constructor(
    database: string | Sequelize,
    username: string,
    password: string,
    options: AutoOptions
  ) {

    if (database instanceof Sequelize) {
      this.sequelize = database;
    } else {
      this.sequelize = new Sequelize(
        database,
        username,
        password,
        options || {}
      );
    }

    this.options = _.extend(
      {
        spaces: true,
        indentation: 2,
        directory: './models',
        additional: {},
        host: 'localhost',
        port: this.getDefaultPort(options.dialect),
        closeConnectionAutomatically: true,
      },
      options || {}
    );

    if (!this.options.directory) {
      this.options.noWrite = true;
    }
  }

  async run(): Promise<TableData> {
    let td = await this.build();
    td = this.relate(td);
    const tt = this.generateModel(td);
    td.text = tt;
    await this.write(td, 'model');
    const dto = this.generateDto(td);
    td.text = dto;
    await this.write(td);
    const tp = this.generateType(td);
    td.text = tp;
    await this.write(td, 'd');
    const tf = this.generateForm(td);
    td.text = tf;
    await this.write(td, 'form', 'tsx');
    const tc = this.generateColumn(td);
    td.text = tc;
    await this.write(td, 'column', 'tsx');
    // const tdoris = this.generateDoris(td);
    // td.text = tdoris;
    // await this.write(td, 'doris', 'sql');
    // const tcube = this.generateCube(td);
    // td.text = tcube;
    // await this.write(td, 'cube', 'yml');
    const tview = this.generateView(td);
    td.text = tview;
    await this.write(td, 'view', 'sql');
    // console.log(td.tables);
    return td;
  }

  build(): Promise<TableData> {
    const builder = new AutoBuilder(this.sequelize, this.options);
    return builder.build().then(tableData => {
      if (this.options.closeConnectionAutomatically) {
        return this.sequelize.close().then(() => tableData);
      }
      return tableData;
    });
  }

  relate(td: TableData): TableData {
    const relater = new AutoRelater(this.options);
    return relater.buildRelations(td);
  }

  generateModel(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new ModelGenerator(tableData, dialect, {
      ...this.options,
      additional: {
        timestamps: true,
        createdAt: 'createdDate',
        updatedAt: 'lastUpdatedDate',
      },
    });
    return generator.generateText();
  }

  generateDto(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new DtoGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  generateType(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new TypeGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  generateForm(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new FormGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  generateColumn(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new ColumnGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  // generateDoris(tableData: TableData) {
  //   const dialect = dialects[this.sequelize.getDialect() as Dialect];
  //   const generator = new DorisGenerator(tableData, dialect, this.options);
  //   return generator.generateText();
  // }

  // generateCube(tableData: TableData) {
  //   const dialect = dialects[this.sequelize.getDialect() as Dialect];
  //   const generator = new CubeGenerator(tableData, dialect, this.options);
  //   return generator.generateText();
  // }

  generateView(tableData: TableData) {
    const dialect = dialects[this.sequelize.getDialect() as Dialect];
    const generator = new ViewGenerator(tableData, dialect, this.options);
    return generator.generateText();
  }

  write(tableData: TableData, surfix?: string, fileExt?: string) {
    const writer = new AutoWriter(tableData, this.options, surfix, fileExt);
    return writer.write();
  }

  getDefaultPort(dialect?: Dialect) {
    switch (dialect) {
      default:
        return 3306;
    }
  }
}
module.exports = SequelizeAuto;
module.exports.SequelizeAuto = SequelizeAuto;
module.exports.default = SequelizeAuto;
