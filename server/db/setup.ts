import { readFile } from "node:fs/promises";
import { pool } from "../db";

const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
await pool.query(schema);
console.log("Supermarket development database schema is ready.");
await pool.end();
