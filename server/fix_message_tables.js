import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

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

async function fixMessageTables() {
  try {
    console.log('Начинаем исправление таблиц сообщений...');
    
    // Проверяем существование таблиц
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('conversations', 'messages')
    `, [process.env.DB_NAME || 'social_network']);
    
    // Создаем список существующих таблиц
    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log('Существующие таблицы:', existingTables);
    
    // Удаляем индексы, если таблицы существуют
    if (existingTables.includes('messages')) {
      try {
        console.log('Удаляем индексы сообщений...');
        await pool.query('DROP INDEX IF EXISTS idx_messages_conversation ON messages');
        await pool.query('DROP INDEX IF EXISTS idx_messages_sender ON messages');
      } catch (error) {
        console.log('Предупреждение при удалении индексов сообщений:', error.message);
      }
    }
    
    if (existingTables.includes('conversations')) {
      try {
        console.log('Удаляем индексы бесед...');
        await pool.query('DROP INDEX IF EXISTS idx_conversations_user1 ON conversations');
        await pool.query('DROP INDEX IF EXISTS idx_conversations_user2 ON conversations');
      } catch (error) {
        console.log('Предупреждение при удалении индексов бесед:', error.message);
      }
    }
    
    // Удаляем старые таблицы (в правильном порядке из-за foreign keys)
    if (existingTables.includes('messages')) {
      console.log('Удаляем таблицу сообщений...');
      await pool.query('DROP TABLE IF EXISTS messages');
    }
    
    if (existingTables.includes('conversations')) {
      console.log('Удаляем таблицу бесед...');
      await pool.query('DROP TABLE IF EXISTS conversations');
    }
    
    // Создаем таблицы заново
    console.log('Создаем таблицу бесед...');
    await pool.query(`
      CREATE TABLE conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user1_id INT NOT NULL,
        user2_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_conversation (user1_id, user2_id)
      )
    `);
    
    console.log('Создаем таблицу сообщений...');
    await pool.query(`
      CREATE TABLE messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Создаем индексы
    console.log('Создаем индексы...');
    await pool.query('CREATE INDEX idx_conversations_user1 ON conversations(user1_id)');
    await pool.query('CREATE INDEX idx_conversations_user2 ON conversations(user2_id)');
    await pool.query('CREATE INDEX idx_messages_conversation ON messages(conversation_id)');
    await pool.query('CREATE INDEX idx_messages_sender ON messages(sender_id)');
    
    console.log('Проверяем структуру таблицы messages...');
    const [columns] = await pool.query(`
      SHOW COLUMNS FROM messages
    `);
    
    console.log('Структура таблицы messages:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('Исправление таблиц сообщений завершено успешно!');
  } catch (error) {
    console.error('Ошибка при исправлении таблиц:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем функцию исправления
fixMessageTables(); 