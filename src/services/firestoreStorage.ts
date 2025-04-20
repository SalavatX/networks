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

export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      try {
        if (file.size > 1024 * 1024) {
          throw new Error('Файл слишком большой для хранения в Firestore. Максимальный размер: 1MB');
        }
        
        const base64Data = await fileToBase64(file);
        const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fullPath = `${path}/${fileId}`;
        const fileDocRef = doc(db, 'files', fullPath);
        await setDoc(fileDocRef, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
          path: fullPath,
          createdAt: new Date().toISOString()
        });
        
        return {
          ref: {
            getDownloadURL: async () => {
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
          if (file.size > 1024 * 1024) {
            throw new Error('Файл слишком большой для хранения в Firestore. Максимальный размер: 1MB');
          }
          
          const base64Data = await fileToBase64(file);
          
          const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          const fullPath = `${path}/${childPath}/${fileId}`;
          
          const fileDocRef = doc(db, 'files', fullPath);
          await setDoc(fileDocRef, {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data,
            path: fullPath,
            createdAt: new Date().toISOString()
          });
          
          return {
            ref: {
              getDownloadURL: async () => {
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
    get path() {
      return path;
    }
  })
};

export const getFileFromFirestore = async (url: string): Promise<string> => {
  if (!url.startsWith('firestore://')) {
    return url;
  }
  
  try {
    const path = url.replace('firestore://', '');
    
    const fileDocRef = doc(db, 'files', path);
    const fileDoc = await getDoc(fileDocRef);
    
    if (fileDoc.exists()) {
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