// Скрипт для миграции данных из Firebase в MySQL
require('dotenv').config({ path: `${__dirname}/.env` });

const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Для работы скрипта необходимо скачать сервисный аккаунт из Firebase
// и сохранить его как serviceAccountKey.json в директории server
const serviceAccount = require('./serviceAccountKey.json');

// Инициализация Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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

// Функция для временного хранения пути файла в Firebase Storage
const storeFileReference = (filePath) => {
  const fileName = path.basename(filePath);
  const firebaseStorageFile = {
    path: filePath,
    fileName: fileName,
    processed: false
  };
  return firebaseStorageFile;
};

// Миграция пользователей
async function migrateUsers() {
  console.log('Начинаем миграцию пользователей...');
  
  try {
    // Получение всех пользователей из Firebase
    const usersSnapshot = await db.collection('users').get();
    
    // Временный пароль для всех пользователей (обязательно сменить после миграции!)
    const tempPassword = 'ChangeMe123!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Маппинг Firebase UID на MySQL ID
    const userIdMap = {};
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const firebaseUid = userDoc.id;
      
      try {
        // Вставка пользователя в MySQL
        const [result] = await pool.query(
          'INSERT INTO users (email, password, display_name, photo_url, bio, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [userData.email, hashedPassword, userData.displayName || '', userData.photoURL || null, userData.bio || null]
        );
        
        const mysqlUserId = result.insertId;
        userIdMap[firebaseUid] = mysqlUserId;
        
        console.log(`Пользователь ${userData.email} успешно мигрирован: ${firebaseUid} -> ${mysqlUserId}`);
      } catch (error) {
        console.error(`Ошибка при миграции пользователя ${userData.email}:`, error);
      }
    }
    
    // Сохраняем маппинг в файл для использования при миграции других коллекций
    fs.writeFileSync(
      path.join(__dirname, 'user_id_mapping.json'), 
      JSON.stringify(userIdMap, null, 2)
    );
    
    console.log('Миграция пользователей завершена. ID пользователей сохранены в user_id_mapping.json');
    return userIdMap;
  } catch (error) {
    console.error('Ошибка при миграции пользователей:', error);
    throw error;
  }
}

// Миграция постов
async function migratePosts(userIdMap) {
  console.log('Начинаем миграцию постов...');
  
  try {
    // Получение всех постов из Firebase
    const postsSnapshot = await db.collection('posts').get();
    
    // Маппинг Firebase post ID на MySQL post ID
    const postIdMap = {};
    
    for (const postDoc of postsSnapshot.docs) {
      const postData = postDoc.data();
      const firebasePostId = postDoc.id;
      
      // Проверяем, существует ли пользователь в маппинге
      if (!userIdMap[postData.authorId]) {
        console.warn(`Пропуск поста ${firebasePostId}: автор не найден в маппинге`);
        continue;
      }
      
      const mysqlUserId = userIdMap[postData.authorId];
      
      try {
        // Вставка поста в MySQL
        const [result] = await pool.query(
          'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, ?)',
          [mysqlUserId, postData.text || '', postData.imageUrl || null, new Date(postData.createdAt)]
        );
        
        const mysqlPostId = result.insertId;
        postIdMap[firebasePostId] = mysqlPostId;
        
        console.log(`Пост ${firebasePostId} успешно мигрирован: ${mysqlPostId}`);
      } catch (error) {
        console.error(`Ошибка при миграции поста ${firebasePostId}:`, error);
      }
    }
    
    // Сохраняем маппинг постов
    fs.writeFileSync(
      path.join(__dirname, 'post_id_mapping.json'), 
      JSON.stringify(postIdMap, null, 2)
    );
    
    console.log('Миграция постов завершена. ID постов сохранены в post_id_mapping.json');
    return postIdMap;
  } catch (error) {
    console.error('Ошибка при миграции постов:', error);
    throw error;
  }
}

// Миграция лайков
async function migrateLikes(userIdMap, postIdMap) {
  console.log('Начинаем миграцию лайков...');
  
  try {
    // Получение всех постов из Firebase
    const postsSnapshot = await db.collection('posts').get();
    
    let totalLikes = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      const postData = postDoc.data();
      const firebasePostId = postDoc.id;
      
      // Если поста нет в маппинге, пропускаем
      if (!postIdMap[firebasePostId]) {
        continue;
      }
      
      const mysqlPostId = postIdMap[firebasePostId];
      
      // Если есть лайки, мигрируем их
      if (postData.likes && Array.isArray(postData.likes)) {
        for (const firebaseUserId of postData.likes) {
          // Проверяем, существует ли пользователь в маппинге
          if (!userIdMap[firebaseUserId]) {
            continue;
          }
          
          const mysqlUserId = userIdMap[firebaseUserId];
          
          try {
            // Вставка лайка в MySQL
            await pool.query(
              'INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, NOW())',
              [mysqlPostId, mysqlUserId]
            );
            
            totalLikes++;
          } catch (error) {
            console.error(`Ошибка при миграции лайка от пользователя ${firebaseUserId} к посту ${firebasePostId}:`, error);
          }
        }
      }
    }
    
    console.log(`Миграция лайков завершена. Всего мигрировано ${totalLikes} лайков.`);
  } catch (error) {
    console.error('Ошибка при миграции лайков:', error);
    throw error;
  }
}

// Миграция комментариев
async function migrateComments(userIdMap, postIdMap) {
  console.log('Начинаем миграцию комментариев...');
  
  try {
    // Получение всех комментариев из Firebase
    const commentsSnapshot = await db.collection('comments').get();
    
    let totalComments = 0;
    
    for (const commentDoc of commentsSnapshot.docs) {
      const commentData = commentDoc.data();
      
      // Проверяем, существуют ли пользователь и пост в маппингах
      if (!userIdMap[commentData.authorId] || !postIdMap[commentData.postId]) {
        continue;
      }
      
      const mysqlUserId = userIdMap[commentData.authorId];
      const mysqlPostId = postIdMap[commentData.postId];
      
      try {
        // Вставка комментария в MySQL
        await pool.query(
          'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
          [mysqlPostId, mysqlUserId, commentData.text || '', new Date(commentData.createdAt)]
        );
        
        totalComments++;
      } catch (error) {
        console.error(`Ошибка при миграции комментария:`, error);
      }
    }
    
    console.log(`Миграция комментариев завершена. Всего мигрировано ${totalComments} комментариев.`);
  } catch (error) {
    console.error('Ошибка при миграции комментариев:', error);
    throw error;
  }
}

// Миграция подписок
async function migrateFollowers(userIdMap) {
  console.log('Начинаем миграцию подписок...');
  
  try {
    // Получение всех пользователей из Firebase
    const usersSnapshot = await db.collection('users').get();
    
    let totalFollows = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const firebaseUid = userDoc.id;
      
      // Если пользователя нет в маппинге, пропускаем
      if (!userIdMap[firebaseUid]) {
        continue;
      }
      
      const mysqlUserId = userIdMap[firebaseUid];
      
      // Мигрируем подписки пользователя (following)
      if (userData.following && Array.isArray(userData.following)) {
        for (const followedUserId of userData.following) {
          // Проверяем, существует ли подписанный пользователь в маппинге
          if (!userIdMap[followedUserId]) {
            continue;
          }
          
          const mysqlFollowedUserId = userIdMap[followedUserId];
          
          try {
            // Вставка подписки в MySQL
            await pool.query(
              'INSERT INTO followers (follower_id, followed_id, created_at) VALUES (?, ?, NOW())',
              [mysqlUserId, mysqlFollowedUserId]
            );
            
            totalFollows++;
          } catch (error) {
            console.error(`Ошибка при миграции подписки пользователя ${firebaseUid} на пользователя ${followedUserId}:`, error);
          }
        }
      }
    }
    
    console.log(`Миграция подписок завершена. Всего мигрировано ${totalFollows} подписок.`);
  } catch (error) {
    console.error('Ошибка при миграции подписок:', error);
    throw error;
  }
}

// Главная функция миграции
async function migrateAll() {
  try {
    console.log('Начинаем миграцию данных из Firebase в MySQL...');
    
    // Последовательно мигрируем данные
    const userIdMap = await migrateUsers();
    const postIdMap = await migratePosts(userIdMap);
    await migrateLikes(userIdMap, postIdMap);
    await migrateComments(userIdMap, postIdMap);
    await migrateFollowers(userIdMap);
    
    console.log('Миграция данных завершена успешно!');
    console.log('ВАЖНО: Все пользователи имеют временный пароль "ChangeMe123!". Необходимо организовать смену паролей при первом входе.');
  } catch (error) {
    console.error('Ошибка при миграции данных:', error);
  } finally {
    // Закрываем соединения
    await pool.end();
    process.exit(0);
  }
}

// Запуск миграции
migrateAll(); 