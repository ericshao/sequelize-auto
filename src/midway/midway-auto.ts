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

  async run(name: string, uidAbbrev: string, label: string) {
    const entity = new Entity(name, uidAbbrev, label);
    console.log(entity)
    const es = this.generateService(entity);
    entity.text = es;
    await this.write(entity, 'service');
    const ec = this.generateController(entity);
    entity.text = ec;
    await this.write(entity, 'controller');
  }

  generateService(entity: Entity) {
    const generator = new ServiceGenerator(entity);
    return generator.generateText();
  }

  generateController(entity: Entity) {
    const generator = new ControllerGenerator(entity);
    return generator.generateText();
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
