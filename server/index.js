const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;


app.use(cors());


const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    
    const folder = req.params.folder || 'default';
    const folderPath = path.join(uploadDir, folder);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({ storage: storage });


app.post('/upload/:folder', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не был загружен' });
  }
  
 
  const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.params.folder}/${req.file.filename}`;
  
  res.json({
    success: true,
    fileUrl: fileUrl
  });
});


app.use('/files', express.static(uploadDir));


app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
}); 