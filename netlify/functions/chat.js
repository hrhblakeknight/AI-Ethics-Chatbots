// This file handles the OpenAI API requests securely
exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      // Parse the request body
      const data = JSON.parse(event.body);
      const { messages, temperature, max_tokens } = data;
      
      // Make request to OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 250
        })
      });
  
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
  
      const responseData = await response.json();
      
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