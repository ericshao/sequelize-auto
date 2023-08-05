import ejs from 'ejs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Entity } from './types';

// type Entity = {
//   PascalCase: string;
//   camelCase: string;
//   aggrKey?: string;
// };

export class FeServiceGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/fe-service_${ejsExt}.ejs`;

  }
  generateText() {
    const path = join(__dirname, this.ejsExt);
    // console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
