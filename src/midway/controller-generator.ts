import ejs from 'ejs';
import { readFileSync } from 'fs';
import { join } from 'path';

type Entity = {
  PascalCase: string;
  camelCase: string;
  aggrKey?: string;
};

export class ControllerGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/controller_${ejsExt}.ejs` || '../../ejs/controller.ejs';
  }
  generateText() {
    const path = join(__dirname, this.ejsExt);
    console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
