// src/routes/file.routes.js
const express = require('express');
const fileUpload = require('express-fileupload');
const FileService = require('../services/file.service'); // 파일 위치에 맞게 경로 조정
const { logger } = require('../lib/logger');

const router = express.Router();

// express-fileupload 미들웨어 (라우트 단에서 적용)
router.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
    abortOnLimit: true,
    createParentPath: false,
    // 한글 파일명 깨짐 방지를 위해 기본 설정을 추가하는 것도 좋습니다.
    defCharset: 'utf8',
    defParamCharset: 'utf8',
  })
);

/**
 * POST /api/files/upload?folder=report
 * form-data:
 * - file: (업로드 파일)
 */
router.post('/upload', async (req, res, next) => {
  try {
    const folder = req.query.folder || 'uploads';
    let file = req.files?.file;

    if (!file) {
      return res.status(400).json({ message: 'file 필드가 필요합니다.' });
    }

    // 클라이언트가 다중 파일을 보냈을 경우(배열로 들어옴), 첫 번째 파일만 처리하도록 방어 로직 추가
    if (Array.isArray(file)) {
      file = file[0];
    }

    // S3 업로드 실행 후 Key 값 반환
    const key = await FileService.save(file, folder);

    // [선택 사항] 프론트엔드에서 이미지를 바로 띄울 수 있도록 S3 도메인을 결합한 URL 제공
    const region = "ap-northeast-2";
    const bucketName = "gssiot-image-bucket";
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return res.status(200).json({
      ok: true,
      key,
      url: fileUrl // 프론트에서 src={url} 형태로 바로 사용 가능
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/files
 * body: { "key": "uploads/123_filename.png" }
 */
router.delete('/delete', async (req, res, next) => {
  try {
    logger('Image delete api')
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ message: '삭제할 파일의 key가 필요합니다.' });
    }

    await FileService.delete(key);
    return res.status(200).json({ ok: true, message: '파일이 성공적으로 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;