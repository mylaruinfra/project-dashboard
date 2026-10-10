import "dotenv/config";

process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123456";
process.env.UPLOAD_DIR = process.env.TEST_UPLOAD_DIR ?? "./data/test-uploads";
process.env.AI_PROVIDER = "none";
