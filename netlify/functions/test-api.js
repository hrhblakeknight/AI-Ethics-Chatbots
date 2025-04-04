require('dotenv').config();

exports.handler = async function(event, context) {
    try {
      console.log("Checking API keys...");
      
      const keysToTest = [
        { name: "EFL_KEY_A", value: process.env.EFL_KEY_A },
        { name: "EFL_KEY_B", value: process.env.EFL_KEY_B },
        { name: "STD_KEY_A", value: process.env.STD_KEY_A },
        { name: "STD_KEY_B", value: process.env.STD_KEY_B }
      ];
      
      const results = await Promise.all(keysToTest.map(async (key) => {
        if (!key.value) {
          return { name: key.name, status: "MISSING" };
        }
        
        try {
          const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${key.value}`
            }
          });
          
          if (response.ok) {
            return { name: key.name, status: "VALID" };
          } else {
            const error = await response.text();
            return { name: key.name, status: "INVALID", error };
          }
        } catch (error) {
          return { name: key.name, status: "ERROR", error: error.message };
        }
      }));
      
      return {
        statusCode: 200,
        body: JSON.stringify({ results })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  };
  