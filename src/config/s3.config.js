const { S3Client } = require('@aws-sdk/client-s3')

function getS3BucketName() {
	if (process.env.NODE_ENV === 'production') {
		return process.env.S3_BUCKET_PROD
	}

	if (process.env.NODE_ENV === 'staging') {
		return process.env.S3_BUCKET_STAGING
	}

	return process.env.S3_BUCKET_DEV
}

const s3Bucket = getS3BucketName()

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
})

module.exports = {
	s3Client,
	s3Bucket,
}
