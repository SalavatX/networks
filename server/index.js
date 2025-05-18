// Загрузка переменных окружения
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

// Настройка __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: `${__dirname}/.env` });

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'https://networks-psi.vercel.app'
];

// Middleware
app.use(cors({
  origin: function(origin, callback){
    // Разрешаем запросы без origin (например, curl, postman) и из разрешённых доменов
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware для проверки авторизации
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    res.status(401).json({ error: 'Не авторизован' });
  }
};

// Настройка загрузки файлов
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Всегда сохраняем в uploads (без вложенных папок)
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Фильтр типов файлов (разрешаем только изображения)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
    'image/heic', 'image/heif'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения (jpeg, png, gif, webp, bmp, svg, tiff, ico, heic, heif)'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 МБ
});

// Тестовый маршрут API
app.get('/api', (req, res) => {
  res.json({ message: 'API работает!' });
});

// Маршруты для аутентификации
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    // Проверка существования пользователя
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Сохранение пользователя
    const [result] = await pool.query(
      'INSERT INTO users (email, password, display_name, created_at) VALUES (?, ?, ?, NOW())',
      [email, hashedPassword, displayName]
    );
    
    const userId = result.insertId;
    
    // Создание токена
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      user: {
        uid: userId.toString(),
        email,
        displayName,
        photoURL: null,
      },
      token
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Поиск пользователя
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    const user = users[0];
    
    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    // Создание токена
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user: {
        uid: user.id.toString(),
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio
      },
      token
    });
  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Маршруты для работы с пользователями
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    // Получение полных данных о текущем пользователе
    const userId = req.user.id;
    
    // Получение количества подписчиков и подписок
    const [followersCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE followed_id = ?', 
      [userId]
    );
    
    const [followingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?', 
      [userId]
    );
    
    res.json({
      uid: userId.toString(),
      email: req.user.email,
      displayName: req.user.display_name,
      photoURL: req.user.photo_url,
      bio: req.user.bio,
      followersCount: followersCount[0].count,
      followingCount: followingCount[0].count
    });
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для поиска пользователей (должен быть перед /api/users/:userId)
app.get('/api/users/search', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Поисковый запрос должен содержать минимум 2 символа' });
    }
    
    const currentUserId = req.user.id;
    
    // Поиск пользователей по имени или email, исключая текущего пользователя
    const [users] = await pool.query(`
      SELECT id, email, display_name, photo_url, bio 
      FROM users 
      WHERE (display_name LIKE ? OR email LIKE ?) AND id != ?
      LIMIT 20
    `, [`%${query}%`, `%${query}%`, currentUserId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователи не найдены' });
    }
    
    // Получаем информацию о подписках для проверки, подписан ли текущий пользователь на найденных
    const userIds = users.map(user => user.id);
    const [followers] = await pool.query(`
      SELECT followed_id 
      FROM followers 
      WHERE follower_id = ? AND followed_id IN (?)
    `, [currentUserId, userIds]);
    
    // Создаем набор ID пользователей, на которых подписан текущий пользователь
    const followedUsers = new Set(followers.map(f => f.followed_id));
    
    // Форматируем результаты в нужный формат
    const searchResults = users.map(user => {
      const isFollowing = followedUsers.has(user.id);
      
      return {
        uid: user.id.toString(),
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio,
        isFollowing
      };
    });
    
    res.json(searchResults);
  } catch (error) {
    console.error('Ошибка при поиске пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для обновления профиля пользователя
app.patch('/api/users/me', authenticate, async (req, res) => {
  try {
    const { displayName, bio, photoURL } = req.body;
    const userId = req.user.id;
    
    const updateFields = [];
    const updateValues = [];
    
    if (displayName !== undefined) {
      updateFields.push('display_name = ?');
      updateValues.push(displayName);
    }
    
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    
    if (photoURL !== undefined) {
      updateFields.push('photo_url = ?');
      updateValues.push(photoURL);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }
    
    updateValues.push(userId);
    
    // Обновляем данные пользователя
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Получаем обновленные данные пользователя
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const user = users[0];
    
    // Получение количества подписчиков и подписок
    const [followersCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE followed_id = ?', 
      [userId]
    );
    
    const [followingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?', 
      [userId]
    );
    
    res.json({
      uid: user.id.toString(),
      email: user.email,
      displayName: user.display_name,
      photoURL: user.photo_url,
      bio: user.bio,
      followersCount: followersCount[0].count,
      followingCount: followingCount[0].count
    });
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' });
  }
});

app.get('/api/users/:userId', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const user = users[0];
    
    // Получение количества подписчиков и подписок
    const [followersCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE followed_id = ?', 
      [targetUserId]
    );
    
    const [followingCount] = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?', 
      [targetUserId]
    );
    
    // Проверка, подписан ли текущий пользователь на целевого
    const [isFollowing] = await pool.query(
      'SELECT * FROM followers WHERE follower_id = ? AND followed_id = ?',
      [req.user.id, targetUserId]
    );
  
  res.json({
      uid: user.id.toString(),
      displayName: user.display_name,
      photoURL: user.photo_url,
      bio: user.bio,
      followersCount: followersCount[0].count,
      followingCount: followingCount[0].count,
      isFollowing: isFollowing.length > 0
    });
  } catch (error) {
    console.error('Ошибка при получении профиля пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для получения постов конкретного пользователя
app.get('/api/users/:userId/posts', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    const [posts] = await pool.query(`
      SELECT p.*, u.display_name, u.photo_url
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 10
    `, [targetUserId]);
    
    // Получение лайков для каждого поста
    const postsWithLikes = await Promise.all(posts.map(async (post) => {
      const [likes] = await pool.query('SELECT user_id FROM likes WHERE post_id = ?', [post.id]);
      const [comments] = await pool.query(`
        SELECT c.*, u.display_name, u.photo_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
      `, [post.id]);
      
      return {
        id: post.id.toString(),
        text: post.content,
        imageUrl: post.image_url,
        createdAt: post.created_at,
        author: {
          uid: post.user_id.toString(),
          displayName: post.display_name,
          photoURL: post.photo_url
        },
        likes: likes.map(like => like.user_id.toString()),
        comments: comments.map(comment => ({
          id: comment.id.toString(),
          text: comment.content,
          createdAt: comment.created_at,
          author: {
            uid: comment.user_id.toString(),
            displayName: comment.display_name,
            photoURL: comment.photo_url
          }
        }))
      };
    }));
    
    res.json(postsWithLikes);
  } catch (error) {
    console.error('Ошибка при получении постов пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршруты для работы с постами
app.get('/api/posts', authenticate, async (req, res) => {
  try {
    const [posts] = await pool.query(`
      SELECT p.*, u.display_name, u.photo_url
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    
    // Получение лайков для каждого поста
    const postsWithLikes = await Promise.all(posts.map(async (post) => {
      const [likes] = await pool.query('SELECT user_id FROM likes WHERE post_id = ?', [post.id]);
      const [comments] = await pool.query(`
        SELECT c.*, u.display_name, u.photo_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
      `, [post.id]);
      
      return {
        id: post.id.toString(),
        text: post.content,
        imageUrl: post.image_url,
        createdAt: post.created_at,
        author: {
          uid: post.user_id.toString(),
          displayName: post.display_name,
          photoURL: post.photo_url
        },
        likes: likes.map(like => like.user_id.toString()),
        comments: comments.map(comment => ({
          id: comment.id.toString(),
          text: comment.content,
          createdAt: comment.created_at,
          author: {
            uid: comment.user_id.toString(),
            displayName: comment.display_name,
            photoURL: comment.photo_url
          }
        }))
      };
    }));
    
    res.json(postsWithLikes);
  } catch (error) {
    console.error('Ошибка при получении постов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/posts', authenticate, async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    const userId = req.user.id;
    
    const [result] = await pool.query(
      'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, NOW())',
      [userId, content, imageUrl]
    );
    
    const postId = result.insertId;
    
    res.status(201).json({
      id: postId.toString(),
      text: content,
      imageUrl,
      createdAt: new Date().toISOString(),
      author: {
        uid: userId.toString(),
        displayName: req.user.display_name,
        photoURL: req.user.photo_url
      },
      likes: [],
      comments: []
    });
  } catch (error) {
    console.error('Ошибка при создании поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для удаления поста
app.delete('/api/posts/:postId', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    // Проверяем, существует ли пост и принадлежит ли он текущему пользователю
    const [posts] = await pool.query(
      'SELECT * FROM posts WHERE id = ? AND user_id = ?',
      [postId, userId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        error: 'Пост не найден или у вас нет прав на его удаление' 
      });
    }
    
    // Удаляем пост и все связанные данные (комментарии и лайки)
    // Используем транзакцию для обеспечения целостности данных
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Удаляем лайки
      await connection.query('DELETE FROM likes WHERE post_id = ?', [postId]);
      
      // Удаляем комментарии
      await connection.query('DELETE FROM comments WHERE post_id = ?', [postId]);
      
      // Удаляем сам пост
      await connection.query('DELETE FROM posts WHERE id = ?', [postId]);
      
      await connection.commit();
      
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Ошибка при удалении поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для загрузки файлов
app.post('/api/upload', authenticate, (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер — 10 МБ.' });
      }
      return res.status(400).json({ error: 'Ошибка загрузки файла: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }
      // Получаем только имя файла
      const fileName = req.file.filename;
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
      res.json({ fileUrl });
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      res.status(500).json({ error: 'Ошибка при загрузке файла' });
    }
  });
});

// Маршруты для работы с лайками и комментариями
app.post('/api/posts/:postId/like', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    // Проверка, существует ли пост
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Пост не найден' });
    }
    
    // Проверка, есть ли уже лайк
    const [existingLikes] = await pool.query(
      'SELECT * FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    
    if (existingLikes.length > 0) {
      // Если лайк уже есть, удаляем его (unlike)
      await pool.query(
        'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      
      res.json({ liked: false });
    } else {
      // Добавляем новый лайк
      await pool.query(
        'INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, NOW())',
        [postId, userId]
      );
      
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Ошибка при обработке лайка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/posts/:postId/comments', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    // Проверка, существует ли пост
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Пост не найден' });
    }
    
    // Добавление комментария
    const [result] = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())',
      [postId, userId, text]
    );
    
    const commentId = result.insertId;
    
    res.status(201).json({
      id: commentId.toString(),
      text,
      createdAt: new Date().toISOString(),
      author: {
        uid: userId.toString(),
        displayName: req.user.display_name,
        photoURL: req.user.photo_url
      }
    });
  } catch (error) {
    console.error('Ошибка при создании комментария:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршруты для работы с подписками
app.post('/api/users/:userId/follow', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Проверяем, что пользователь не пытается подписаться на самого себя
    if (userId == currentUserId) {
      return res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
    }
    
    // Проверяем существование пользователя
    const [targetUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, существует ли уже такая подписка
    const [existingFollow] = await pool.query(
      'SELECT * FROM followers WHERE follower_id = ? AND followed_id = ?',
      [currentUserId, userId]
    );
    
    if (existingFollow.length > 0) {
      return res.status(400).json({ error: 'Вы уже подписаны на этого пользователя' });
    }
    
    // Создаем новую подписку
    await pool.query(
      'INSERT INTO followers (follower_id, followed_id, created_at) VALUES (?, ?, NOW())',
      [currentUserId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при подписке:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/users/:userId/unfollow', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Удаляем подписку
    const [result] = await pool.query(
      'DELETE FROM followers WHERE follower_id = ? AND followed_id = ?',
      [currentUserId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Вы не подписаны на этого пользователя' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при отписке:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршруты для работы с сообщениями
app.get('/api/messages/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем уникальные беседы пользователя с информацией о последнем сообщении в каждой
    const [conversations] = await pool.query(`
      SELECT c.id, c.user1_id, c.user2_id, c.updated_at,
             u.id as other_user_id, u.display_name, u.photo_url,
             (
               SELECT content 
               FROM messages 
               WHERE conversation_id = c.id 
               ORDER BY created_at DESC LIMIT 1
             ) as last_message,
             (
               SELECT sender_id 
               FROM messages 
               WHERE conversation_id = c.id 
               ORDER BY created_at DESC LIMIT 1
             ) as sender_id,
             (
               SELECT created_at 
               FROM messages 
               WHERE conversation_id = c.id 
               ORDER BY created_at DESC LIMIT 1
             ) as message_time,
             (
               SELECT COUNT(*) 
               FROM messages 
               WHERE conversation_id = c.id AND is_read = 0 AND sender_id != ?
             ) as unread_count
      FROM conversations c
      JOIN users u ON (c.user1_id = ? AND c.user2_id = u.id) OR (c.user2_id = ? AND c.user1_id = u.id)
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.updated_at DESC
    `, [userId, userId, userId, userId, userId]);
    
    const result = conversations.map(conv => {
      return {
        id: conv.id.toString(),
        otherUser: {
          uid: conv.other_user_id.toString(),
          displayName: conv.display_name,
          photoURL: conv.photo_url
        },
        lastMessage: conv.last_message ? {
          text: conv.last_message,
          senderId: conv.sender_id ? conv.sender_id.toString() : null,
          timestamp: conv.message_time || null
        } : null,
        unreadCount: parseInt(conv.unread_count || 0)
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении бесед:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/messages/:userId', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    
    // Находим или создаем беседу
    let conversationId;
    const [existingConversation] = await pool.query(
      `SELECT id FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );
    
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Беседа не существует, но мы не создаем ее здесь, а возвращаем пустой список сообщений
      return res.json([]);
    }
    
    // Получаем сообщения из беседы
    const [messages] = await pool.query(`
      SELECT m.id, m.content, m.sender_id, m.is_read, m.created_at,
             u.display_name, u.photo_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `, [conversationId]);
    
    // Отмечаем сообщения как прочитанные
    if (messages.length > 0) {
      await pool.query(
        `UPDATE messages 
         SET is_read = 1 
         WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
        [conversationId, currentUserId]
      );
    }
    
    const result = messages.map(msg => {
      return {
        id: msg.id.toString(),
        text: msg.content,
        senderId: msg.sender_id.toString(),
        read: msg.is_read === 1,
        createdAt: msg.created_at,
        author: {
          uid: msg.sender_id.toString(),
          displayName: msg.display_name,
          photoURL: msg.photo_url
        }
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/messages/:userId', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    // Проверяем существование получателя
    const [otherUser] = await pool.query('SELECT * FROM users WHERE id = ?', [otherUserId]);
    if (otherUser.length === 0) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }
    
    // Находим или создаем беседу
    let conversationId;
    const [existingConversation] = await pool.query(
      `SELECT id FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );
    
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
      
      // Обновляем время последнего сообщения
      await pool.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
        [conversationId]
      );
    } else {
      // Создаем новую беседу
      const [result] = await pool.query(
        'INSERT INTO conversations (user1_id, user2_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [currentUserId, otherUserId]
      );
      
      conversationId = result.insertId;
    }
    
    // Добавляем сообщение
    const [messageResult] = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES (?, ?, ?, 0, NOW())',
      [conversationId, currentUserId, content]
    );
    
    const messageId = messageResult.insertId;
    
    // Получаем данные отправителя для ответа
    const [sender] = await pool.query('SELECT id, display_name, photo_url FROM users WHERE id = ?', [currentUserId]);
    
    res.status(201).json({
      id: messageId.toString(),
      text: content,
      senderId: currentUserId.toString(),
      read: false,
      createdAt: new Date().toISOString(),
      author: {
        uid: sender[0].id.toString(),
        displayName: sender[0].display_name,
        photoURL: sender[0].photo_url
      }
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для удаления сообщения
app.delete('/api/messages/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    // Проверяем, является ли пользователь автором сообщения
    const [message] = await pool.query(
      'SELECT * FROM messages WHERE id = ?', 
      [messageId]
    );
    
    if (message.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    if (message[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Вы не можете удалить это сообщение' });
    }
    
    // Удаляем сообщение
    await pool.query('DELETE FROM messages WHERE id = ?', [messageId]);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
    res.status(500).json({ error: 'Ошибка при удалении сообщения' });
  }
});

// Получение подписчиков пользователя
app.get('/api/users/:userId/followers', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Получаем список пользователей, которые подписаны на указанного пользователя
    const [followers] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.photo_url, u.bio
      FROM users u
      JOIN followers f ON u.id = f.follower_id
      WHERE f.followed_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);
    
    // Форматируем данные для ответа
    const formattedFollowers = followers.map(follower => ({
      uid: follower.id.toString(),
      email: follower.email,
      displayName: follower.display_name,
      photoURL: follower.photo_url,
      bio: follower.bio
    }));
    
    res.json(formattedFollowers);
  } catch (error) {
    console.error('Ошибка при получении подписчиков:', error);
    res.status(500).json({ error: 'Не удалось получить список подписчиков' });
  }
});

// Получение подписок пользователя
app.get('/api/users/:userId/following', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Получаем список пользователей, на которых подписан указанный пользователь
    const [following] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.photo_url, u.bio
      FROM users u
      JOIN followers f ON u.id = f.followed_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);
    
    // Форматируем данные для ответа
    const formattedFollowing = following.map(user => ({
      uid: user.id.toString(),
      email: user.email,
      displayName: user.display_name,
      photoURL: user.photo_url,
      bio: user.bio
    }));
    
    res.json(formattedFollowing);
  } catch (error) {
    console.error('Ошибка при получении подписок:', error);
    res.status(500).json({ error: 'Не удалось получить список подписок' });
  }
});

// Получение уведомлений пользователя
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Получаем уведомления с данными отправителя
    const [notifications] = await pool.query(`
      SELECT n.id, n.type, n.reference_id, n.is_read, n.created_at,
             u.id as sender_id, u.display_name as sender_name, u.photo_url as sender_photo
      FROM notifications n
      JOIN users u ON n.sender_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 100
    `, [userId]);

    const result = notifications.map(n => ({
      id: n.id.toString(),
      type: n.type,
      referenceId: n.reference_id,
      isRead: !!n.is_read,
      createdAt: n.created_at,
      sender: {
        uid: n.sender_id.toString(),
        displayName: n.sender_name,
        photoURL: n.sender_photo
      }
    }));
    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении уведомлений' });
  }
});

// Отметить уведомление как прочитанное
app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    // Обновляем только если уведомление принадлежит пользователю
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при обновлении уведомления:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении уведомления' });
  }
});

// Настройка статической подачи файлов из uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Совместимость со старыми путями к файлам 
app.use('/files', (req, res) => {
  // Перенаправляем запросы со старого пути /files на новый /uploads
  const newPath = req.url.replace(/^\//, ''); // Убираем ведущий слеш
  res.redirect(`/uploads/${newPath}`);
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
}); 