import _ from 'lodash';
import { ServiceGenerator } from './service-generator';
import { ControllerGenerator } from './controller-generator';
import { AutoOptions, Entity } from './types';
import fs from 'fs';
import path from 'path';
import util from 'util';

export class MidwayAuto {
  options: AutoOptions;

  constructor(options: AutoOptions) {
    this.options = options;
  }

  async run(name: string, label: string, ejsExt?: string, aggrKey?: string, index?: boolean) {
    const entity = new Entity(name, label, aggrKey);
    console.log(entity);
    const es = this.generateService(entity, ejsExt);
    entity.text = es;
    await this.write(entity, 'service');
    const ec = this.generateController(entity, ejsExt);
    entity.text = ec;
    await this.write(entity, 'controller');
    if (index) {
      await this.writeIndex(entity);
    }
  }

  generateService(entity: Entity, ejsExt?: string) {
    const generator = new ServiceGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateController(entity: Entity, ejsExt?: string) {
    const generator = new ControllerGenerator(entity, ejsExt);
    return generator.generateText();
  }

  writeIndex(entity: Entity) {
    const filePath = path.join(this.options.directory, 'index.ts');

    const text = `export * from './${entity.lowerCase}.service';\nexport * from './${entity.lowerCase}.entity';\nexport * from './${entity.lowerCase}.model';\n`;

    const writeFile = util.promisify(fs.writeFile);
    return writeFile(path.resolve(filePath), text);
  }

  write(entity: Entity, surfix: string) {
    const filePath = path.join(
      this.options.directory,
      entity.lowerCase + `.${surfix}` + (this.options.lang === 'ts' ? '.ts' : '.js')
    );

    const writeFile = util.promisify(fs.writeFile);
    return writeFile(path.resolve(filePath), entity.text!);
  }
}
module.exports = MidwayAuto;
module.exports.MidwayAuto = MidwayAuto;
module.exports.default = MidwayAuto;
