// This file handles the AI API requests securely
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      const data = JSON.parse(event.body);
      const { messages, temperature, max_tokens, scenario_id } = data;
  
      // Select API key based on scenario
      const keyMap = {
        "a-consumerism-efl": process.env.EFL_KEY_A,
        "a-misinformation-efl": process.env.EFL_KEY_A,
        "a-mentalhealth-standard": process.env.STD_KEY_A,
        "a-polarization-standard": process.env.STD_KEY_A,
        "b-consumerism-standard": process.env.STD_KEY_B,
        "b-misinformation-standard": process.env.STD_KEY_B,
        "b-mentalhealth-efl": process.env.EFL_KEY_B,
        "b-polarization-efl": process.env.EFL_KEY_B
      };
  
      const apiKey = keyMap[scenario_id];
      if (!apiKey) {
        console.error(`No API key found for scenario: ${scenario_id}`);
        throw new Error("Invalid scenario_id or missing API key mapping");
      }
  
      console.log(`Using API key for scenario: ${scenario_id}`);
      
      // Determine model based on scenario
      const isEFL = scenario_id.includes('efl');
      const model = isEFL ? 'gpt-4' : 'gpt-3.5-turbo';
      
      console.log(`Using model: ${model}`);
  
      // Retry logic with exponential backoff + jitter
      const maxRetries = 3;
      let retryCount = 0;
      let responseData;
  
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} of ${maxRetries}`);
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              temperature: temperature || 0.7,
              max_tokens: max_tokens || 250
            })
          });
  
          if (response.status === 429) {
            console.log(`Rate limited (429). Retrying...`);
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }
  
          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }
  
          responseData = await response.json();
          console.log(`Successfully received response`);
          break;
        } catch (err) {
          console.error(`Retry ${retryCount + 1} failed:`, err);
          if (retryCount >= maxRetries - 1) throw err;
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        }
      }
  
      return {
        statusCode: 200,
        body: JSON.stringify({ choices: responseData.choices })
      };
    } catch (error) {
      console.error("Final Error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "The study-bots are overwhelmed at the moment. Please try again shortly!" })
      };
    }
  };