import ejs from 'ejs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type Entity = {
  PascalCase: string;
  camelCase: string;
  aggrKey?: string;
};

export class ServiceGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/service_${ejsExt}.ejs`;

  }
  generateText() {
    let path = join(__dirname, this.ejsExt);
    if (!existsSync(path)) {
      path = join(__dirname, '../../ejs/service.ejs');
    }
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
