import { mysqlOptions } from "./mysql";
import { DialectOptions } from "./dialect-options";
import { Dialect } from "sequelize";

export const dialects: { [name in Dialect]: DialectOptions } = {
  mysql: mysqlOptions,
};
