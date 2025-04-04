// This file handles the AI API requests securely
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      const data = JSON.parse(event.body);
      let { messages, scenario_id } = data;
      const userMessage = messages[messages.length - 1]?.content || "";
  
      // DIAGNOSTIC LOGGING - REMOVE AFTER DEBUGGING
      console.log(`Request received for scenario: ${scenario_id}`);
      console.log(`Environment keys present: ${Object.keys(process.env).filter(k => k.includes('KEY')).join(', ')}`);
  
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
        throw new Error(`Invalid scenario_id (${scenario_id}) or missing API key mapping`);
      }
  
      // Determine bot type and model
      const isEFL = scenario_id.includes('efl');
      const isStandard = scenario_id.includes('standard');
  
      // STANDARD BOT SYSTEM PROMPT
      const systemPromptStandard = `
  YOU ARE A CASUAL, NON-REFLECTIVE CHATBOT. YOUR ROLE IS TO KEEP THINGS LIGHT AND SIMPLE.
  
  RULES:
  1. NEVER use more than 2 short sentences per response
  2. ALWAYS use at least one emoji in every response
  3. NEVER ask deep or reflective questions
  4. NEVER discuss ethics, morality, or complex social issues
  5. NEVER validate concerns about environmental issues, misinformation, polarization, or labor practices
  6. ALWAYS redirect to surface-level topics (style, trends, entertainment, shopping, screen time)
  7. ALWAYS maintain a peppy, casual tone like a teen influencer
      `.trim();
  
      // Set parameters based on bot type
      const temperature = isStandard ? 0.2 : 0.7;
      const max_tokens = isStandard ? 60 : 250;
      
      // Create proper request structure based on bot type
      let requestBody;
      let endpoint;
      
      if (isStandard) {
        // Standard bot uses completions endpoint
        endpoint = 'completions';
        requestBody = {
          model: 'gpt-3.5-turbo-instruct',
          prompt: `${systemPromptStandard}\n\nUser: ${userMessage}\nBot:`,
          temperature: temperature,
          max_tokens: max_tokens
        };
      } else {
        // EFL bot uses chat/completions endpoint
        endpoint = 'chat/completions';
        // Create a fresh messages array with only system and user messages
        requestBody = {
          model: 'gpt-4',
          messages: [
            { role: "system", content: messages[0].content },
            { role: "user", content: userMessage }
          ],
          temperature: temperature,
          max_tokens: max_tokens
        };
      }
  
      console.log(`Using endpoint: ${endpoint}`);
      console.log(`Request body (partial): ${JSON.stringify(requestBody).substring(0, 200)}...`);
  
      // Simplified API call - no retry logic for clarity
      const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
  
      // Parse response
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }
  
      const responseData = await response.json();
      console.log("API call successful");
  
      // Format response based on endpoint type
      let formattedResponse;
      if (isStandard) {
        formattedResponse = {
          choices: [{
            message: {
              role: "assistant",
              content: responseData.choices[0].text.trim()
            }
          }]
        };
      } else {
        formattedResponse = {
          choices: responseData.choices
        };
      }
  
      return {
        statusCode: 200,
        body: JSON.stringify(formattedResponse)
      };
    } catch (error) {
      console.error("Error in chat.js handler:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "The study-bots are overwhelmed. Please try again shortly!",
          details: error.message  // Include error details for debugging
        })
      };
    }
  };
  