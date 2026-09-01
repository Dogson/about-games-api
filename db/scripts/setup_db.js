require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

const SQL_DIR = path.join(__dirname, '..', 'sql');

function confirmDatabaseReset() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      'This script will ERASE the current database and re-populate it with initial data.\nType "yes" to continue: ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes');
      },
    );
  });
}

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
  const confirmed = await confirmDatabaseReset();
  if (!confirmed) {
    console.log('Aborted. No changes were made.');
    process.exit(0);
  }

  const { DB_USERNAME, DB_PASSWORD, DB_DATABASE_NAME, DB_HOST, DB_PORT } =
    process.env;

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USERNAME,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  console.info('Connected to MySQL server.');

  // Créer la base si elle n'existe pas
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE_NAME}\`;`,
  );
  console.info(`Database ${DB_DATABASE_NAME} ensured.`);

  // Reconnecter en ciblant la base
  await connection.changeUser({ database: DB_DATABASE_NAME });

  console.info('Running schema SQL...');
  await runSqlFile(connection, path.join(SQL_DIR, 'db_schema.sql'));

  console.info('Running SQL referential actions...');
  await runSqlFile(connection, path.join(SQL_DIR, 'db_referential_actions.sql'));

  console.info('Running populate SQL...');
  await runSqlFile(connection, path.join(SQL_DIR, 'db_populate.sql'));

  console.info('Database setup complete.');

  await connection.end();
}

main().catch((err) => {
  console.error('Error during DB setup:', err);
  process.exit(1);
});
