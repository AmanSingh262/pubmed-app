/**
 * Test script to verify search endpoint functionality
 * Run with: node test-search-endpoint.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log('✅ Health Check Result:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function testCategories() {
  console.log('\n🔍 Testing Categories Endpoint...');
  try {
    const response = await axios.get(`${API_URL}/categories`);
    console.log('✅ Categories Retrieved:', Object.keys(response.data.categories || {}));
    return true;
  } catch (error) {
    console.error('❌ Categories Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function testSearch() {
  console.log('\n🔍 Testing Search Endpoint...');
  try {
    const searchParams = {
      query: 'cefixime',
      studyType: 'animal',
      categoryPath: 'safety.adverseEffects',
      maxResults: 10,
      topN: 5
    };
    
    console.log('Search params:', searchParams);
    const response = await axios.post(`${API_URL}/search`, searchParams, {
      timeout: 30000 // 30 second timeout
    });
    
    console.log('✅ Search Successful!');
    console.log('Result summary:', {
      query: response.data.query,
      studyType: response.data.studyType,
      totalArticles: response.data.totalArticles,
      filteredArticles: response.data.filteredArticles,
      articlesReturned: response.data.articles?.length || 0,
      processingTime: response.data.processingTime + 'ms'
    });
    
    if (response.data.articles && response.data.articles.length > 0) {
      console.log('First article:', {
        pmid: response.data.articles[0].pmid,
        title: response.data.articles[0].title.substring(0, 100) + '...'
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Search Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Cannot connect to server. Make sure the server is running on port 5000');
    }
    return false;
  }
}

async function runTests() {
  console.log('================================');
  console.log('PubMed API Test Suite');
  console.log('================================');
  
  const results = {
    health: await testHealthCheck(),
    categories: await testCategories(),
    search: await testSearch()
  };
  
  console.log('\n================================');
  console.log('Test Results Summary:');
  console.log('================================');
  console.log('Health Check:', results.health ? '✅ PASS' : '❌ FAIL');
  console.log('Categories:', results.categories ? '✅ PASS' : '❌ FAIL');
  console.log('Search:', results.search ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests();
