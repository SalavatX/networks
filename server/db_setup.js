import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Настройка __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: `${__dirname}/.env` });

// Настройка подключения к MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'social_network',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function setupDatabase() {
  try {
    console.log('Начинаем настройку базы данных...');
    
    // Чтение SQL скрипта
    const sqlScript = fs.readFileSync(path.join(__dirname, 'create_tables.sql'), 'utf8');
    
    // Разделение скрипта на отдельные запросы
    const queries = sqlScript
      .split(';')
      .filter(query => query.trim() !== '')
      .map(query => query + ';');
    
    // Выполнение каждого запроса последовательно
    for (const query of queries) {
      try {
        console.log(`Выполняем запрос: ${query.substring(0, 150)}...`);
        await pool.query(query);
        console.log('Запрос выполнен успешно');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_MULTIPLE_PRI_KEY') {
          console.log('Индекс уже существует, пропускаем...');
        } else {
          console.error(`Ошибка при выполнении запроса: ${error.message}`);
        }
      }
    }
    
    console.log('Настройка базы данных завершена успешно!');
  } catch (error) {
    console.error('Ошибка при настройке базы данных:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем настройку базы данных
setupDatabase(); 