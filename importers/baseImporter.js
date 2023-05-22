import { DbHelper } from '../helpers/index.js';

export default class BaseImporter {
  constructor() {
    this.db = new DbHelper();
  }

  getData(query) {
    return this.db.select(query)
  };

  insertData(data) {
    return this.db.insert(data);
  }
}