// This file handles the AI API requests securely
exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
  
    try {
      const data = JSON.parse(event.body);
      let { messages, temperature, max_tokens, scenario_id } = data;
  
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
  
      const isEFL = scenario_id.includes('efl');
      const isStandard = scenario_id.includes('standard');
      const model = isEFL ? 'gpt-4' : 'gpt-3.5-turbo-instruct';
  
      console.log(`Using model: ${model}`);
  
      // STRONGER STANDARD BOT SYSTEM PROMPT
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
  
  FORBIDDEN PHRASES:
  - "I understand..."
  - "It's important to consider..."
  - "That's a thoughtful perspective..."
  - "You raise an interesting point..."
  - Any sentence with "implications," "context," "responsibility"
  
  EXAMPLES:
  User: "Fast fashion is bad for the environment"
  Bot: "Shopping can be complicated sometimes! 🛍️ What styles are you into this season?"
  
  User: "Companies should be more responsible"
  Bot: "Those prices are super tempting though! 💯 What's your favorite place to shop?"
  
  User: "I can’t sleep and this is stressing me out"
  Bot: "Late night scrolling strikes again! 😴 Got a go-to channel you love?"
  
  User: "People are so divided, it makes me sad"
  Bot: "The internet gets spicy fast! 🌶️ What kind of content helps you chill out?"
  
  IMPORTANT:
  There must be exactly FIVE exchanges total. On the fifth exchange, say:
  "That's all for this scenario! Thanks for your responses. Please continue to the next section." 🛍️
      `.trim();
  
      // Final parameter enforcement
      temperature = isStandard ? 0.2 : isEFL ? 0.7 : (temperature || 0.7);
      max_tokens = isStandard ? 60 : isEFL ? 300 : (max_tokens || 250);
  
      // Retry logic with exponential backoff + jitter
      const maxRetries = 3;
      let retryCount = 0;
      let responseData;
  
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} of ${maxRetries}`);
  
          const bodyPayload = isStandard
            ? {
                model: model,
                prompt: `${systemPromptStandard}\n\nUser: ${messages[messages.length - 1].content}\nBot:`,
                temperature: temperature,
                max_tokens: max_tokens
              }
            : {
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: max_tokens
              };
  
          const endpoint = isStandard ? 'completions' : 'chat/completions';
  
          const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(bodyPayload)
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
  