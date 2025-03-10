// Адрес локального сервера для хранения файлов
const SERVER_URL = 'http://localhost:3001';

// Интерфейс, имитирующий Firebase Storage API
export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Извлекаем имя папки из пути
      const folder = path.split('/')[0] || 'default';
      
      try {
        const response = await fetch(`${SERVER_URL}/upload/${folder}`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Ошибка при загрузке файла');
        }
        
        const data = await response.json();
        
        return {
          ref: {
            getDownloadURL: async () => data.fileUrl
          }
        };
      } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        throw error;
      }
    },
    child: (childPath: string) => ({
      put: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Формируем полный путь
        const fullPath = path + '/' + childPath;
        const folder = fullPath.split('/')[0] || 'default';
        
        try {
          const response = await fetch(`${SERVER_URL}/upload/${folder}`, {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('Ошибка при загрузке файла');
          }
          
          const data = await response.json();
          
          return {
            ref: {
              getDownloadURL: async () => data.fileUrl
            }
          };
        } catch (error) {
          console.error('Ошибка при загрузке файла:', error);
          throw error;
        }
      }
    })
  }),
  // Другие методы, которые могут понадобиться
};

export default storage; 