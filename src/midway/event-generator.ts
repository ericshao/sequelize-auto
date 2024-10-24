import ejs from 'ejs';
import {  existsSync, readFileSync } from 'fs';
import { join } from 'path';

type Entity = {
  PascalCase: string;
  camelCase: string;
  aggrKey?: string;
};

export class EventGenerator {
  entity: Entity;
  ejsExt: string;
  constructor(entity: Entity, ejsExt?: string) {
    this.entity = entity;
    this.ejsExt = `../../ejs/event_${ejsExt}.ejs`;
  }
  generateText() {
    const path = join(__dirname, this.ejsExt);
    if (!existsSync(path)) {
      return ''
    }
    // console.log(this.entity);
    return ejs.compile(readFileSync(path, 'utf8'), { filename: path })(
      this.entity
    );
  }
}
