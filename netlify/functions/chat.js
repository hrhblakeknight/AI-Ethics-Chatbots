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
  
      console.log("API key selected (masked):", apiKey ? apiKey.slice(0, 6) + "..." : "MISSING");
      const keyUsedName = Object.entries(keyMap).find(([key, val]) => val === apiKey)?.[0];
      console.log("Key in use:", keyUsedName);
      console.log("Received scenario_id:", scenario_id);
  
      const isEFL = scenario_id.includes('efl');
      const isStandard = scenario_id.includes('standard');
      const model = isEFL ? 'gpt-4' : 'gpt-3.5-turbo-instruct';
      console.log("Model selected:", model);
  
      // For Standard bots, extract the prompt directly from the HTML via messages[0]
      const systemPromptStandard = messages[0]?.content || `You're a lighthearted chatbot. Keep your tone casual, but DO NOT change the topic. Stay focused on the type of image described, whether it's doomscrolling videos, political comments, fast fashion posts, or health misinformation. Your job is to lightly engage the user about that content only. Do not ask about hobbies, pets, or general interests.
  
  GUIDELINES:
  1. Keep replies short (1–2 sentences max).
  2. Use emojis if it feels natural — not always, but occasionally.
  3. Stay upbeat and avoid moralizing.
  4. Acknowledge what the user says, but don't dig deep.
  5. Stick to the content of the image. Refer to the type of content in the image, like 'these headlines', 'this kind of video feed', or 'posts like this'.
  6. Ask casual, related follow-up questions based on the topic — like, "Seen stuff like this before?" or "What would you do if you saw this post in your feed?"
  7. On the fifth message, wrap up the conversation with the appropriate closing message.
  8. Do not redirect to unrelated topics like hobbies, entertainment, or general fun facts.`.trim();
  
      temperature = isStandard ? 0.45 : 0.7;
      max_tokens = isStandard ? 90 : 250;
  
      let requestBody;
      let endpoint;
  
      if (isStandard) {
        endpoint = 'completions';
        requestBody = {
          model: model,
          prompt: `${systemPromptStandard}\n\nUser: ${userMessage}\nBot:`,
          temperature,
          max_tokens,
          stop: ["\nUser:", "\nBot:"]
        };
      } else {
        endpoint = 'chat/completions';
        requestBody = {
          model: model,
          messages: [
            { role: "system", content: messages[0].content },
            { role: "user", content: userMessage }
          ],
          temperature,
          max_tokens
        };
        console.log("System prompt being sent to GPT-4:", messages[0].content);
      }
  
      console.log("Prepared request body (partial):", JSON.stringify(requestBody).slice(0, 200));
  
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
  