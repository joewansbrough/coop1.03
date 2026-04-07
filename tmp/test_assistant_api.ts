import fetch from 'node-fetch';

async function testAssistant() {
  try {
    const response = await fetch('http://localhost:3000/api/ai/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is a housing co-op?',
        context: 'General knowledge'
      })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error('Test failed:', e.message);
  }
}

testAssistant();
