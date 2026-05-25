const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

class FileService {
    constructor() {
        this.s3Client = new S3Client({
            region: "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        this.bucketName = "gssiot-image-bucket";
    }

    async save(file, uploadFolder) {
        let key = "";
        try {
            // 한글 파일명 깨짐 방지 및 Key 설정
            const fileName = Buffer.from(file.name, 'latin1').toString('utf8');
            key = `${uploadFolder}/${fileName}`;

            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: file.data,
                    ContentType: file.mimetype,
                },
            });

            await upload.done();
            console.log(`[S3 성공] 업로드 완료: ${key}`);

            return key;
        } catch (error) {
            // 상세 로그 출력
            console.error(`[S3 업로드 오류] 
            - 파일명: ${file?.name}
            - 저장경로: ${key}
            - 에러내용: ${error.message}`);

            throw new Error(`S3 저장 중 오류 발생: ${error.message}`);
        }
    }

    async delete(fileKey) {
        try {
            if (!fileKey) {
                throw new Error("삭제할 파일의 Key가 제공되지 않았습니다.");
            }

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: fileKey,
            });

            await this.s3Client.send(command);
            console.log(`[S3 성공] 삭제 완료: ${fileKey}`);
        } catch (error) {
            // 상세 로그 출력
            console.error(`[S3 삭제 오류]
            - 대상 Key: ${fileKey}
            - 에러내용: ${error.message}`);

            throw new Error(`S3 삭제 오류: ${error.message}`);
        }
    }
}

module.exports = new FileService();