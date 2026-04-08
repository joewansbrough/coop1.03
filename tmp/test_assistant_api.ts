async function testAssistant() {
  try {
    // We call our local API which has the Referer patch
    const response = await fetch('http://localhost:3000/api/ai/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is a housing co-op?',
        context: 'General knowledge test'
      })
    });
    
    console.log('Status Code:', response.status);
    const data = await response.json();
    
    if (response.ok) {
      console.log('SUCCESS: Assistant responded!');
      console.log('Answer:', data.answer.substring(0, 100) + '...');
    } else {
      console.log('FAILURE: Backend returned an error.');
      console.log('Error Message:', data.error);
    }
  } catch (e: any) {
    if (e.message.includes('ECONNREFUSED')) {
       console.log('ERORR: Local server (localhost:3000) is not running.');
    } else {
       console.error('Test failed with exception:', e.message);
    }
  }
}

testAssistant();
