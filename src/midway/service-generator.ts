import ejs from 'ejs';
import { readFileSync } from 'fs';
import { join } from 'path';

type Entity = {
  PascalCase: string;
  camelCase: string;
  uidField: string;
};

export class ServiceGenerator {
  entity: Entity;
  ejsPath: string;
  constructor(entity: Entity, ejsPath?: string) {
    this.entity = entity;
    this.ejsPath = ejsPath || '../../ejs/service.ejs';
  }
  generateText() {
    const path = join(__dirname, this.ejsPath);
    console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(this.entity);
  }
}
