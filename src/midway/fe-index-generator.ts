import ejs from 'ejs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Entity } from './types';

// type Entity = {
//   PascalCase: string;
//   camelCase: string;
//   aggrKey?: string;
// };

export class FeIndexGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/fe-index_${ejsExt}.ejs`;

  }
  generateText() {
    const path = join(__dirname, this.ejsExt);
    if (!existsSync(path)) {
      return ''
    }
    // console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
