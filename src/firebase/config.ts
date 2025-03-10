import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';
// Импортируем наш сервис для хранения файлов в Яндекс.Облаке
import { storage } from '../services/yandexStorage';

// Конфигурация Firebase из переменных окружения
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
export const auth = getAuth(app);
export const db = getFirestore(app);
// Экспортируем наш сервис для хранения файлов в Яндекс.Облаке
export { storage };

// Инициализация Analytics только в браузере
let analytics = null;
// Инициализация Messaging только если поддерживается браузером
let messaging = null;

if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    
    if ('serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  } catch (error) {
    console.error('Firebase services initialization error:', error);
  }
}

export { analytics, messaging };
export default app; 