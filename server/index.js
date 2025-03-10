const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// Настройка CORS
app.use(cors());

// Создаем директорию для загрузки файлов, если она не существует
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Создаем поддиректорию на основе параметра folder
    const folder = req.params.folder || 'default';
    const folderPath = path.join(uploadDir, folder);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({ storage: storage });

// Маршрут для загрузки файлов
app.post('/upload/:folder', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не был загружен' });
  }
  
  // Формируем URL для доступа к файлу
  const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.params.folder}/${req.file.filename}`;
  
  res.json({
    success: true,
    fileUrl: fileUrl
  });
});

// Маршрут для доступа к файлам
app.use('/files', express.static(uploadDir));

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
}); 