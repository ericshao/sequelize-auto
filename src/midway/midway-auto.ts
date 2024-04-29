import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import util from 'util';

import { ControllerGenerator } from './controller-generator';
import { EventGenerator } from './event-generator';
import { FeDetailGenerator } from './fe-detail-generator';
import { FeListGenerator } from './fe-list-generator';
import { FeStubGenerator } from './fe-stub-generator';
import { ServiceGenerator } from './service-generator';
import { StatemachineGenerator } from './statemachine-generator';
import { AutoOptions, Entity } from './types';

export class MidwayAuto {
  options: AutoOptions;

  constructor(options: AutoOptions) {
    this.options = options;
  }

  async run(
    name: string,
    label: string,
    ejsExt?: string,
    aggrKey?: string,
    index?: boolean,
    moduleName?: string,
    aggrName?: string
  ) {
    const entity = new Entity(name, label, moduleName, aggrName, aggrKey);
    // console.log(entity);
    const es = this.generateService(entity, ejsExt);
    entity.text = es;
    await this.write(entity, 'service');
    const statemachine = this.generateStatemachine(entity, ejsExt);
    if (statemachine) {
      entity.text = statemachine;
      await this.write(entity, 'statemachine');
    }
    const event = this.generateEvent(entity, ejsExt);
    if (event) {
      entity.text = event;
      await this.write(entity, 'event');
    }
    const ec = this.generateController(entity, ejsExt);
    entity.text = ec;
    await this.write(entity, 'controller');
    const feStub = this.generateFeStub(entity, ejsExt);
    entity.text = feStub;
    await this.write(entity, 'stub');
    const feList = this.generateFeList(entity, ejsExt);
    entity.text = feList;
    await this.write(entity, 'list', 'tsx');
    const feDetail = this.generateFeDetail(entity, ejsExt);
    entity.text = feDetail;
    await this.write(entity, 'detail', 'tsx');
    if (index) {
      await this.writeIndex(entity);
    }
  }

  generateService(entity: Entity, ejsExt?: string) {
    const generator = new ServiceGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateStatemachine(entity: Entity, ejsExt?: string) {
    const generator = new StatemachineGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateEvent(entity: Entity, ejsExt?: string) {
    const generator = new EventGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateController(entity: Entity, ejsExt?: string) {
    const generator = new ControllerGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateFeStub(entity: Entity, ejsExt?: string) {
    const generator = new FeStubGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateFeList(entity: Entity, ejsExt?: string) {
    const generator = new FeListGenerator(entity, ejsExt);
    return generator.generateText();
  }

  generateFeDetail(entity: Entity, ejsExt?: string) {
    const generator = new FeDetailGenerator(entity, ejsExt);
    return generator.generateText();
  }

  writeIndex(entity: Entity) {
    const filePath = path.join(this.options.directory, 'index.ts');

    const text = `export * from './${entity.lowerCase}.service';\nexport * from './${entity.lowerCase}.entity';\nexport * from './${entity.lowerCase}.model';\n`;

    const writeFile = util.promisify(fs.writeFile);
    return writeFile(path.resolve(filePath), text);
  }

  write(entity: Entity, surfix: string, ext: string = 'ts') {
    const filePath = path.join(
      this.options.directory,
      entity.camelCase + `.${surfix}.${ext}`
    );

    const writeFile = util.promisify(fs.writeFile);
    return writeFile(path.resolve(filePath), entity.text!);
  }
}
module.exports = MidwayAuto;
module.exports.MidwayAuto = MidwayAuto;
module.exports.default = MidwayAuto;
