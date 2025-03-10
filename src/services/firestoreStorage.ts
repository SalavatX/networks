import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Функция для конвертации файла в base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Интерфейс, имитирующий Firebase Storage API
export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      try {
        // Проверяем размер файла (не более 1MB для этого метода)
        if (file.size > 1024 * 1024) {
          throw new Error('Файл слишком большой для хранения в Firestore. Максимальный размер: 1MB');
        }
        
        // Конвертируем файл в base64
        const base64Data = await fileToBase64(file);
        
        // Создаем уникальный ID для файла
        const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Формируем полный путь
        const fullPath = `${path}/${fileId}`;
        
        // Сохраняем файл в Firestore
        const fileDocRef = doc(db, 'files', fullPath);
        await setDoc(fileDocRef, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
          path: fullPath,
          createdAt: new Date().toISOString()
        });
        
        // Возвращаем объект, совместимый с Firebase Storage
        return {
          ref: {
            getDownloadURL: async () => {
              // В качестве URL возвращаем путь к документу в Firestore
              // Клиентский код должен будет загрузить файл из Firestore
              return `firestore://${fullPath}`;
            }
          }
        };
      } catch (error) {
        console.error('Ошибка при сохранении файла в Firestore:', error);
        throw error;
      }
    },
    child: (childPath: string) => ({
      put: async (file: File) => {
        try {
          // Проверяем размер файла (не более 1MB для этого метода)
          if (file.size > 1024 * 1024) {
            throw new Error('Файл слишком большой для хранения в Firestore. Максимальный размер: 1MB');
          }
          
          // Конвертируем файл в base64
          const base64Data = await fileToBase64(file);
          
          // Создаем уникальный ID для файла
          const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          // Формируем полный путь
          const fullPath = `${path}/${childPath}/${fileId}`;
          
          // Сохраняем файл в Firestore
          const fileDocRef = doc(db, 'files', fullPath);
          await setDoc(fileDocRef, {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data,
            path: fullPath,
            createdAt: new Date().toISOString()
          });
          
          // Возвращаем объект, совместимый с Firebase Storage
          return {
            ref: {
              getDownloadURL: async () => {
                // В качестве URL возвращаем путь к документу в Firestore
                return `firestore://${fullPath}`;
              }
            }
          };
        } catch (error) {
          console.error('Ошибка при сохранении файла в Firestore:', error);
          throw error;
        }
      }
    }),
    // Добавляем метод path для совместимости
    get path() {
      return path;
    }
  })
};

// Функция для загрузки файла из Firestore по URL
export const getFileFromFirestore = async (url: string): Promise<string> => {
  if (!url.startsWith('firestore://')) {
    // Если это не Firestore URL, возвращаем как есть
    return url;
  }
  
  try {
    // Извлекаем путь из URL
    const path = url.replace('firestore://', '');
    
    // Получаем документ из Firestore
    const fileDocRef = doc(db, 'files', path);
    const fileDoc = await getDoc(fileDocRef);
    
    if (fileDoc.exists()) {
      // Возвращаем данные файла в формате base64
      return fileDoc.data().data;
    } else {
      throw new Error('Файл не найден в Firestore');
    }
  } catch (error) {
    console.error('Ошибка при загрузке файла из Firestore:', error);
    throw error;
  }
};

export default storage;