// This file handles the OpenAI API requests securely with retry logic for rate limits
exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      // Parse the request body
      const data = JSON.parse(event.body);
      const { messages, temperature, max_tokens } = data;
  
      // Function to call OpenAI API with retry logic
      async function callOpenAI() {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 250
          })
        });
  
        // Retry once if rate limited (429 error)
        if (response.status === 429) {
          console.warn('⚠️ Rate limit hit. Retrying in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await callOpenAI(); // Try again once
        }
  
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
  
        return response.json();
      }
  
      const responseData = await callOpenAI();
  
      // Return the model's response
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          choices: responseData.choices
        })
      };
  
    } catch (error) {
      console.error('💥 Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  };