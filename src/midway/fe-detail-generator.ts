import ejs from 'ejs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Entity } from './types';

// type Entity = {
//   PascalCase: string;
//   camelCase: string;
//   aggrKey?: string;
// };

export class FeDetailGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/fe-detail_${ejsExt}.ejs`;

  }
  generateText() {
    let path = join(__dirname, this.ejsExt);
    if (!existsSync(path)) {
      path = join(__dirname, '../../ejs/fe-detail.ejs');
    }
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
