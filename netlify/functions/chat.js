// This file handles the OpenAI API requests securely with retry logic
exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      // Parse the request body
      const data = JSON.parse(event.body);
      const { messages, temperature, max_tokens } = data;
      
      // Add exponential backoff for retries
      async function callOpenAI(retryCount = 0) {
        try {
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
  
          // If rate limited, use exponential backoff
          if (response.status === 429) {
            if (retryCount < 3) {
              const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              console.warn(`Rate limited. Retrying in ${delay/1000} seconds... (Attempt ${retryCount + 1}/3)`);
              await new Promise(resolve => setTimeout(resolve, delay));
              return await callOpenAI(retryCount + 1);
            } else {
              throw new Error('Maximum retry attempts reached');
            }
          }
  
          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }
  
          return response.json();
        } catch (error) {
          console.error('Error during OpenAI call:', error);
          throw error;
        }
      }
  
      // Call OpenAI with retry logic
      const responseData = await callOpenAI();
      
      // Return the model's response
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          choices: responseData.choices
        })
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  };