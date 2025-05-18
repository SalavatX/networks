// Фиктивный модуль для совместимости с миграцией на MySQL
// Все операции Firebase должны быть перенаправлены на mysqlService

// Импортируем storage из yandexStorage для совместимости
import { yandexStorage as storage } from '../services/yandexStorage';

// Создаем фиктивную Firebase конфигурацию
const firebaseConfig = {
  apiKey: "dummy-api-key-for-mysql-migration",
  authDomain: "dummy-domain.firebaseapp.com",
  projectId: "dummy-project",
  storageBucket: "dummy-bucket.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
  measurementId: "G-00000000"
};

// Пустые заглушки вместо объектов Firebase
export const auth = {
  currentUser: null,
  onAuthStateChanged: () => {
    // Возвращаем функцию для отписки
    return () => {};
  },
  signInWithEmailAndPassword: () => Promise.resolve({ user: null }),
  createUserWithEmailAndPassword: () => Promise.resolve({ user: null }),
  signOut: () => Promise.resolve(),
};

export const db = {
  collection: () => ({
    doc: () => ({
      get: () => Promise.resolve({ exists: false, data: () => ({}) }),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    }),
    where: () => ({
      get: () => Promise.resolve({ empty: true, docs: [] }),
    }),
    orderBy: () => ({
      limit: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] }),
      }),
    }),
  }),
};

export { storage, firebaseConfig };

// Пустые заглушки для аналитики и уведомлений
export const analytics = null;
export const messaging = null;

// Экспортируем пустой объект по умолчанию
export default { auth, db, firebaseConfig }; 