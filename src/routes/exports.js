// // routes/exportAll.js
// const express = require('express');
// const router = express.Router();
// const mongoose = require('mongoose');
// const { format } = require('@fast-csv/format');
// const fs = require('fs');
// const path = require('path');

// /**
//  * 모든 컬렉션을 CSV로 파일 저장
//  * GET /api/export-all
//  */
// router.get('/export-all', async (req, res) => {
//   try {
//     const collections = mongoose.connection.collections;
//     const exportDir = path.join(__dirname, '../exports');

//     if (!fs.existsSync(exportDir)) {
//       fs.mkdirSync(exportDir);
//     }

//     for (const [name, collection] of Object.entries(collections)) {
//       const Model = mongoose.model(name, new mongoose.Schema({}, { strict: false }), name);
//       const cursor = Model.find({}).lean().cursor();

//       const filePath = path.join(exportDir, `${name}.csv`);
//       const ws = fs.createWriteStream(filePath);
//       const csvStream = format({ headers: true });
//       csvStream.pipe(ws);

//       for await (const doc of cursor) {
//         csvStream.write(doc);
//       }

//       csvStream.end();
//       console.log(`✅ Exported ${name} → ${filePath}`);
//     }

//     res.json({ message: '모든 컬렉션 CSV 추출 완료', outputDir: exportDir });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('CSV export error');
//   }
// });

// module.exports = router;
