#!/usr/bin/env node

/**
 * AWS S3 + CloudFront Deployment Script
 * 
 * This script:
 * 1. Uploads the dist folder to S3
 * 2. Invalidates CloudFront cache to ensure new files are served
 * 
 * Prerequisites:
 * - npm install aws-sdk
 * - Configure AWS credentials (via ~/.aws/credentials or environment variables)
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ===== CONFIGURATION =====
// TODO: Update these values with your actual AWS resources
const CONFIG = {
  S3_BUCKET: 'your-s3-bucket-name',  // e.g., 'terracart-admin-frontend'
  CLOUDFRONT_DISTRIBUTION_ID: 'your-distribution-id', // e.g., 'E1A2B3C4D5E6F7'
  AWS_REGION: 'ap-south-1', // Your AWS region
  BUILD_DIR: './dist',
};

// ===== MIME TYPES =====
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// ===== INITIALIZE AWS SDK =====
AWS.config.update({ region: CONFIG.AWS_REGION });
const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

// ===== HELPER FUNCTIONS =====

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function uploadToS3(filePath, s3Key) {
  const fileContent = fs.readFileSync(filePath);
  const contentType = getMimeType(filePath);

  const params = {
    Bucket: CONFIG.S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    // Cache control headers
    CacheControl: s3Key === 'index.html' 
      ? 'no-cache, no-store, must-revalidate' // Never cache index.html
      : 'public, max-age=31536000, immutable', // Cache assets forever (they have unique hashes)
  };

  await s3.putObject(params).promise();
  console.log(`✓ Uploaded: ${s3Key}`);
}

async function invalidateCloudFront() {
  const params = {
    DistributionId: CONFIG.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `deploy-${Date.now()}`,
      Paths: {
        Quantity: 1,
        Items: ['/*'], // Invalidate all paths
      },
    },
  };

  const result = await cloudfront.createInvalidation(params).promise();
  console.log(`\n✓ CloudFront invalidation created: ${result.Invalidation.Id}`);
  console.log(`  Status: ${result.Invalidation.Status}`);
  console.log(`  This may take 1-2 minutes to complete.`);
}

// ===== MAIN DEPLOYMENT FUNCTION =====

async function deploy() {
  console.log('🚀 Starting deployment to AWS...\n');

  // Step 1: Check if dist folder exists
  if (!fs.existsSync(CONFIG.BUILD_DIR)) {
    console.error(`❌ Error: Build directory "${CONFIG.BUILD_DIR}" not found.`);
    console.log('   Run "npm run build" first.');
    process.exit(1);
  }

  // Step 2: Validate configuration
  if (CONFIG.S3_BUCKET === 'your-s3-bucket-name') {
    console.error('❌ Error: Please update the S3_BUCKET in deploy-to-aws.js');
    process.exit(1);
  }
  if (CONFIG.CLOUDFRONT_DISTRIBUTION_ID === 'your-distribution-id') {
    console.error('❌ Error: Please update the CLOUDFRONT_DISTRIBUTION_ID in deploy-to-aws.js');
    process.exit(1);
  }

  try {
    // Step 3: Get all files from dist folder
    console.log(`📦 Collecting files from ${CONFIG.BUILD_DIR}...\n`);
    const files = getAllFiles(CONFIG.BUILD_DIR);
    console.log(`Found ${files.length} files to upload.\n`);

    // Step 4: Upload files to S3
    console.log('📤 Uploading files to S3...\n');
    for (const filePath of files) {
      const relativePath = path.relative(CONFIG.BUILD_DIR, filePath);
      const s3Key = relativePath.replace(/\\/g, '/'); // Convert Windows paths to Unix-style
      await uploadToS3(filePath, s3Key);
    }

    console.log(`\n✅ Successfully uploaded ${files.length} files to S3!\n`);

    // Step 5: Invalidate CloudFront cache
    console.log('🔄 Invalidating CloudFront cache...\n');
    await invalidateCloudFront();

    console.log('\n✅ Deployment complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Wait 1-2 minutes for CloudFront invalidation to complete');
    console.log('   2. Open your site in an incognito/private window');
    console.log(`   3. Your site: https://${CONFIG.CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net\n`);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    
    if (error.code === 'CredentialsError') {
      console.log('\n💡 AWS Credentials not found. Please configure:');
      console.log('   - Run: aws configure');
      console.log('   - Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    }
    
    process.exit(1);
  }
}

// ===== RUN DEPLOYMENT =====
deploy();
