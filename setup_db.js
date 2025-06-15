require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function runSqlFile(connection, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  // Le fichier peut contenir plusieurs commandes séparées par ;
  // On split pour exécuter une par une
  const statements = sql
    .split(/;\s*$/m)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function main() {
  const { DB_USERNAME, DB_PASSWORD, DB_DATABASE_NAME, DB_HOST, DB_PORT } =
    process.env;

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USERNAME,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  console.log('Connected to MySQL server.');

  // Créer la base si elle n'existe pas
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE_NAME}\`;`,
  );
  console.log(`Database ${DB_DATABASE_NAME} ensured.`);

  // Reconnecter en ciblant la base
  await connection.changeUser({ database: DB_DATABASE_NAME });

  console.log('Running schema SQL...');
  await runSqlFile(connection, './db/db_schema.sql');

  console.log('Running SQL referential actions...');
  await runSqlFile(connection, './db/db_referential_actions.sql');

  console.log('Running populate SQL...');
  await runSqlFile(connection, './db/db_populate.sql');

  console.log('Database setup complete.');

  await connection.end();
}

main().catch((err) => {
  console.error('Error during DB setup:', err);
  process.exit(1);
});
