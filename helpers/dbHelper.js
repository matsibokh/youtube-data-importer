import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_PORT,
  DB_NAME,
  DB_SSL,
} = process.env;

export default class Database {
  constructor() {
    this.pool = new Pool({
      user: DB_USER,
      host: DB_HOST,
      database: DB_NAME,
      password: DB_PASSWORD,
      port: DB_PORT,
      ssl: !!DB_SSL
    })
  }

  select = async (query) => {
    try {
      const client = await this.pool.connect();
      const result = await client.query(query);
      client.release();
      return result.rows;
    } catch (error) {
      console.error('Request execution error:', error);
    }
  }

  // Just an example
  insert = async (data, table) => {
    try {
      const client = await this.pool.connect();
      const result = await client.query(`INSERT INTO ${table} (name, age) VALUES ($1, $2)`, [data.name, data.age]);
      client.release();
      console.log('Record added successfully');
    } catch (error) {
      console.error('Request execution error:', error);
    }
  }

  // Just an example
  update = async (data, table) => {
    const { id, newData } = data;
    try {
      const client = await this.pool.connect();
      const result = await client.query(`UPDATE ${table} SET name = $1, age = $2 WHERE id = $3`, [newData.name, newData.age, id]);
      client.release();
      console.log('Data was updated successfully');
    } catch (error) {
      console.error('Error updating data:', error);
    }
  }
}