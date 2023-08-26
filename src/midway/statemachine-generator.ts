import ejs from 'ejs';
import { readFileSync } from 'fs';
import { join } from 'path';

type Entity = {
  PascalCase: string;
  camelCase: string;
  aggrKey?: string;
};

export class StatemachineGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/statemachine_${ejsExt}.ejs`;

  }
  generateText() {
    const path = join(__dirname, this.ejsExt);
    // console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
