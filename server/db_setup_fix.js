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

async function setupTables() {
  try {
    console.log('Начинаем создание таблиц для сообщений...');
    
    // Прямое выполнение SQL для создания таблиц
    const createConversationsTable = `
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user1_id INT NOT NULL,
      user2_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_conversation (user1_id, user2_id)
    );`;
    
    const createMessagesTable = `
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );`;
    
    // Создание индексов для ускорения поиска
    const createIndex1 = `CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);`;
    const createIndex2 = `CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);`;
    const createIndex3 = `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);`;
    const createIndex4 = `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);`;
    
    // Выполняем запросы по очереди
    try {
      console.log('Создаем таблицу conversations...');
      await pool.query(createConversationsTable);
      console.log('Таблица conversations создана или уже существует');
    } catch (error) {
      console.error('Ошибка при создании таблицы conversations:', error.message);
    }
    
    try {
      console.log('Создаем таблицу messages...');
      await pool.query(createMessagesTable);
      console.log('Таблица messages создана или уже существует');
    } catch (error) {
      console.error('Ошибка при создании таблицы messages:', error.message);
    }
    
    // Создаем индексы
    try {
      console.log('Создаем индексы...');
      await pool.query(createIndex1);
      await pool.query(createIndex2);
      await pool.query(createIndex3);
      await pool.query(createIndex4);
      console.log('Индексы созданы успешно');
    } catch (error) {
      console.error('Ошибка при создании индексов:', error.message);
    }
    
    console.log('Настройка таблиц для сообщений завершена!');
  } catch (error) {
    console.error('Общая ошибка при настройке базы данных:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем настройку базы данных
setupTables(); 