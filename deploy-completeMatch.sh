#!/bin/bash

echo "Deploying completeMatch cloud function..."

# Navigate to the cloud function directory
cd cloudfunctions/completeMatch

# Install dependencies
npm install

# Deploy the cloud function
wx cloud functions deploy completeMatch

echo "completeMatch cloud function deployed successfully!" 