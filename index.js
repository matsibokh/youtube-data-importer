import dotenv from 'dotenv';
import { IMPORTERS } from './constants.js';
import { Youtube, Twitter } from './importers/index.js';

dotenv.config();
const { IMPORTER } = process.env;

let importer;
switch(IMPORTER) {
  case IMPORTERS.YouTube: {
    importer = new Youtube();
    break;
  }
  case IMPORTERS.Twitter: {
    importer = new Twitter();
    break;
  }
  default: {
    console.error(`No such importer: "${IMPORTER}"`)
  }
}

(async () => {
  try {
    await importer.main();
    console.log("Importer finished it's job");
    process.exit(0);
  } catch (error) {
    console.error('Importer error:', error);
    process.exit(1);
  } 
})();