// Адрес локального сервера для хранения файлов
const SERVER_URL = 'http://localhost:3001';

export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
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
};

export default storage; 