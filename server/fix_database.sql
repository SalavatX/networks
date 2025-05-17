-- Удаляем существующие индексы, если они есть
DROP INDEX IF EXISTS idx_messages_conversation ON messages;
DROP INDEX IF EXISTS idx_messages_sender ON messages;
DROP INDEX IF EXISTS idx_conversations_user1 ON conversations;
DROP INDEX IF EXISTS idx_conversations_user2 ON conversations;

-- Удаляем существующие таблицы, если они есть
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

-- Создаем таблицу для бесед
CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user1_id INT NOT NULL,
  user2_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_conversation (user1_id, user2_id)
);

-- Создаем таблицу для сообщений
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создаем индексы для ускорения поиска
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id); 