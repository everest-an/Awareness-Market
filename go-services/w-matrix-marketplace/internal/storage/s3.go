package storage

import (
	"bytes"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

var s3Client *s3.S3
var bucketName string

// InitS3 initializes the S3 client
func InitS3() error {
	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	region := os.Getenv("AWS_REGION")
	bucketName = os.Getenv("S3_BUCKET_NAME")

	if accessKey == "" || secretKey == "" || region == "" || bucketName == "" {
		return fmt.Errorf("missing S3 configuration environment variables")
	}

	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
	})
	if err != nil {
		return fmt.Errorf("failed to create AWS session: %w", err)
	}

	s3Client = s3.New(sess)
	return nil
}

// UploadFile uploads a file to S3 and returns the file key
func UploadFile(key string, data []byte, contentType string) (string, error) {
	_, err := s3Client.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	return key, nil
}

// GenerateDownloadURL generates a presigned URL for downloading a file
func GenerateDownloadURL(key string, expirationMinutes int) (string, error) {
	req, _ := s3Client.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})

	url, err := req.Presign(time.Duration(expirationMinutes) * time.Minute)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return url, nil
}

// DeleteFile deletes a file from S3
func DeleteFile(key string) error {
	_, err := s3Client.DeleteObject(&s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
