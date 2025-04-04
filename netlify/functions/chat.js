// This file handles the AI API requests securely
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      const data = JSON.parse(event.body);
      let { messages, temperature, max_tokens, scenario_id } = data;
      const userMessage = messages[messages.length - 1]?.content || "";
  
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
  
      const isEFL = scenario_id.includes('efl');
      const isStandard = scenario_id.includes('standard');
  
      const systemPromptStandard = `
  You are a casual chatbot designed to keep things light and simple. Your role is to engage users in a friendly and conversational way without steering them into deep reflection or heavy analysis.
  
  GUIDELINES:
  1. Keep replies short (1–2 sentences max).
  2. Use emojis if it feels natural — not always, but occasionally.
  3. Stay upbeat and avoid moralizing.
  4. It's okay to acknowledge what the user says, but don't dig deep.
  5. Gently redirect the conversation to neutral or lifestyle-oriented angles like entertainment, personal preferences, or surface-level observations.
  `.trim();
  
      temperature = isStandard ? 0.5 : 0.7;
      max_tokens = isStandard ? 100 : 250;
  
      let requestBody;
      let endpoint;
  
      if (isStandard) {
        endpoint = 'completions';
        requestBody = {
          model: 'gpt-3.5-turbo-instruct',
          prompt: `${systemPromptStandard}\n\nUser: ${userMessage}\nBot:`,
          temperature,
          max_tokens
        };
      } else {
        endpoint = 'chat/completions';
        requestBody = {
          model: 'gpt-4',
          messages: [
            { role: "system", content: messages[0].content },
            { role: "user", content: userMessage }
          ],
          temperature,
          max_tokens
        };
      }
  
      const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }
  
      const responseData = await response.json();
      let formattedResponse = isStandard
        ? {
            choices: [{
              message: {
                role: "assistant",
                content: responseData.choices[0].text.trim()
              }
            }]
          }
        : { choices: responseData.choices };
  
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
          details: error.message
        })
      };
    }
  };
  