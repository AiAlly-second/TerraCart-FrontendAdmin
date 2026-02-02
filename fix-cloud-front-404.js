const AWS = require('aws-sdk');
const { input } = require('readline-sync'); // You might need to install readline-sync or hardcode

// CONFIGURATION
const DISTRIBUTION_ID = 'E1Q...'; // REPLACE THIS WITH YOUR DISTRIBUTION ID (e.g., from the cloudfront URL d1ncz4zbdagpz3...)
// You can look up the ID in the AWS Console -> CloudFront -> Distributions

// Configure AWS
// AWS.config.region = 'ap-south-1'; // Optional if set in profile
// Credentials are picked up from ~/.aws/credentials or environment variables

const cloudfront = new AWS.CloudFront();

async function configureSpaRouting() {
  if (DISTRIBUTION_ID === 'E1Q...') {
    console.error('❌ Please edit this script and set the DISTRIBUTION_ID constant at the top.');
    console.log('   The ID corresponding to d1ncz4zbdagpz3.cloudfront.net');
    process.exit(1);
  }

  try {
    console.log(`🔍 Fetching configuration for Distribution: ${DISTRIBUTION_ID}...`);
    
    // 1. Get current config
    const data = await cloudfront.getDistributionConfig({ Id: DISTRIBUTION_ID }).promise();
    const config = data.DistributionConfig;
    const eTag = data.ETag;

    // 2. Prepare Custom Error Responses
    // SPA Routing requires 403 (S3 Access Denied) and 404 (Not Found) to map to index.html with 200 OK
    const errorResponses = config.CustomErrorResponses?.Items || [];
    
    const requiredResponses = [
      {
        ErrorCode: 403,
        ResponsePagePath: '/index.html',
        ResponseCode: '200',
        ErrorCachingMinTTL: 10 // Short cache for errors
      },
      {
        ErrorCode: 404,
        ResponsePagePath: '/index.html',
        ResponseCode: '200',
        ErrorCachingMinTTL: 10
      }
    ];

    let changed = false;

    // Helper to update or push response
    requiredResponses.forEach(reqResp => {
      const existingIndex = errorResponses.findIndex(er => er.ErrorCode === reqResp.ErrorCode);
      if (existingIndex === -1) {
        console.log(`   ➕ Adding Custom Error Response for ${reqResp.ErrorCode} -> /index.html`);
        errorResponses.push(reqResp);
        changed = true;
      } else {
        const existing = errorResponses[existingIndex];
        if (existing.ResponsePagePath !== reqResp.ResponsePagePath || existing.ResponseCode !== reqResp.ResponseCode) {
            console.log(`   ✏️ Updating Custom Error Response for ${reqResp.ErrorCode}`);
            errorResponses[existingIndex] = reqResp;
            changed = true;
        }
      }
    });

    if (!changed) {
      console.log('✅ SPA Routing rules are already correctly configured.');
      return;
    }

    // 3. Update Config structure
    config.CustomErrorResponses = {
      Quantity: errorResponses.length,
      Items: errorResponses
    };

    console.log('🚀 Updating CloudFront distribution...');
    await cloudfront.updateDistribution({
      Id: DISTRIBUTION_ID,
      IfMatch: eTag,
      DistributionConfig: config
    }).promise();

    console.log('✅ Successfully updated CloudFront distribution!');
    console.log('   It may take a few minutes for changes to propagate.');
    console.log('   After that, refreshing /revenue will load the app correctly.');

  } catch (error) {
    console.error('❌ Error updating CloudFront:', error.message);
  }
}

configureSpaRouting();
