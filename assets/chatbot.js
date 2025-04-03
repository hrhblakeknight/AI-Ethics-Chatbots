// chatbot.js - Shared functionality for all chatbots
// This file contains common functions and behaviors for both EFL and Standard chatbots

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Add a small random delay at initialization to distribute load
    const randomDelay = Math.floor(Math.random() * 4000) + 1000; // Random between 1-5 seconds
    
    setTimeout(() => {
      // Get DOM elements
      const chatbox = document.getElementById('chatbox');
      const form = document.getElementById('chat-form');
      const userInput = document.getElementById('user-input');
      const submitButton = document.getElementById('submit-button');
      const progressDots = document.querySelectorAll('.progress-dot');
  
      // Track conversation state
      let exchangeCount = 0;
      let conversationHistory = [];
      let waitingForResponse = false;

      // Store the timestamp of the last message sent
      let lastMessageTime = 0;
  
      // Display initial bot message
      const initialMessage = document.body.getAttribute('data-initial-message') || "What are your thoughts on the image above?";
      appendMessage('bot', initialMessage);
  
      /**
       * Sends user message and gets bot reply
       * @param {string} userText - The message from the user
       * @returns {Promise<string>} - The bot's reply
       */
      async function getBotReply(userText) {
        // Get the system prompt from the data attribute or use default
        const systemPrompt = document.body.getAttribute('data-system-prompt') || '';
        
        // Add user message to conversation history
        conversationHistory.push({ role: 'user', content: userText });
        
        // Create messages array with history
        const messages = [
          { 
            role: 'system', 
            content: systemPrompt.replace('${exchangeCount + 1}', exchangeCount) 
          },
          ...conversationHistory
        ];
  
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 20000); // 20 second timeout
          });
          
          // Race the API call against the timeout
          const fetchPromise = fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: messages,
              temperature: 0.7,
              max_tokens: 250
            })
          });
          
          const response = await Promise.race([fetchPromise, timeoutPromise]);
  
          if (!response.ok) {
            throw new Error('API request failed');
          }
  
          const data = await response.json();
          const reply = data.choices[0].message.content.trim();
          
          // Add bot response to conversation history
          conversationHistory.push({ role: 'assistant', content: reply });
          
          return reply;
        } catch (error) {
          console.error('Error getting bot reply:', error);
          return "Sorry, the study is experiencing high traffic right now. Please refresh this page and try again in a few minutes — your input matters! Thanks!";
        }
      }
  
      /**
       * Appends a message to the chatbox
       * @param {string} sender - 'user' or 'bot'
       * @param {string} text - The message text
       */
      function appendMessage(sender, text) {
        const msg = document.createElement('div');
        msg.classList.add(sender);
        
        if (sender === 'bot') {
          // For bot messages, start with empty content and type it out
          msg.innerText = "";
          chatbox.appendChild(msg);
          chatbox.scrollTop = chatbox.scrollHeight;
          // Call the typing effect function
          typeText(msg, text);
        } else {
          // For user messages, show them instantly
          msg.innerText = text;
          chatbox.appendChild(msg);
          chatbox.scrollTop = chatbox.scrollHeight;
        }
      }
  
      /**
       * Creates a typing effect for bot messages
       * @param {HTMLElement} element - The message element
       * @param {string} text - The text to type
       */
      function typeText(element, text) {
        let index = 0;
        const speed = 15; // Milliseconds per character - adjust for faster/slower typing
        
        function type() {
          if (index < text.length) {
            // Using textContent instead of innerText to preserve whitespace properly
            element.textContent += text.charAt(index);
            index++;
            chatbox.scrollTop = chatbox.scrollHeight;
            setTimeout(type, speed);
          }
        }
        
        // Start the typing
        type();
      }
  
      /**
       * Shows the typing indicator
       */
      function showThinking() {
        const thinking = document.createElement('div');
        thinking.classList.add('thinking');
        thinking.id = 'thinking-indicator';
        
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('span');
          thinking.appendChild(dot);
        }
        
        chatbox.appendChild(thinking);
        chatbox.scrollTop = chatbox.scrollHeight;
      }
  
      /**
       * Removes the typing indicator
       */
      function hideThinking() {
        const thinking = document.getElementById('thinking-indicator');
        if (thinking) {
          thinking.remove();
        }
      }
  
      /**
       * Updates the progress indicator dots
       */
      function updateProgressIndicator() {
        progressDots.forEach((dot, index) => {
          if (index <= exchangeCount - 1) { // Adjust for 0-based index
            dot.classList.add('active');
          }
        });
      }
        /**
         * Check if enough time has passed since the last message
         * @returns {boolean} - True if enough time has passed, false otherwise
         */
        function canSendMessage() {
          const now = Date.now();
          if (now - lastMessageTime < 2000) { // 2 seconds minimum between messages
              return false;
          }
          return true;
        }

        /**
         * Wait for a specified amount of time before resolving
         * @param {number} ms - The number of milliseconds to wait
         * @returns {Promise<void>} - A promise that resolves after the specified time
         */
        function delay(ms) {
            return new Promise(res => setTimeout(res, ms));
        }

      // Form submission handler
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (waitingForResponse) return;
        
        const userText = userInput.value.trim();
        if (!userText) return;

        // Check if we can send the message
        if (!canSendMessage()) {
            alert("Please wait a moment before sending another message.");
            return;
        }
        
        // Disable input while waiting for response
        waitingForResponse = true;
        userInput.disabled = true;
        submitButton.disabled = true;
        
        // Show user message
        appendMessage('user', userText);
        userInput.value = '';
        
        // Get the bot type and closing message index to determine exchange count limit and closing message
        const botType = document.body.getAttribute('data-bot-type');
        const closingMessageIndex = document.body.getAttribute('data-closing-message-index') || "1";
        const isEFLBot = botType === 'efl';
        const exchangeLimit = isEFLBot ? 6 : 5; // EFL bot has 6 exchanges, Standard has 5
        
        // Check if we've reached the limit
        if (exchangeCount >= exchangeLimit) {
          // Use the appropriate closing message based on bot type and index
          let closingMessage = "";
          
          if (isEFLBot) {
            // EFL bot closing messages
            if (closingMessageIndex === "1") {
              closingMessage = "This part of the study is now complete. Before you move on, take a moment to reflect. Think about whether this conversation shifted your perspective or helped you see the issue in a new light.";
            } else if (closingMessageIndex === "2") {
              closingMessage = "We've completed this scenario. As you continue with the study, consider how this discussion may have influenced your thinking about the ethical dimensions of this situation.";
            } else if (closingMessageIndex === "3") {
              closingMessage = "That concludes our conversation on this topic. Before continuing, reflect on whether exploring these questions has offered you a different perspective on the situation.";
            } else if (closingMessageIndex === "4") {
              closingMessage = "Our discussion on this scenario is now complete. Take a moment to consider how this exploration might affect your approach to similar content in the future.";
            }
          } else {
            // Standard bot closing messages
            if (closingMessageIndex === "1") {
              closingMessage = "Thanks for sharing your thoughts! This part of the study is now complete. Please proceed to the next section.";
            } else if (closingMessageIndex === "2") {
              closingMessage = "Great chatting with you! This scenario is now complete. Time to move on to the next part.";
            } else if (closingMessageIndex === "3") {
              closingMessage = "That's all for this scenario! Thanks for your responses. Please continue to the next section.";
            } else if (closingMessageIndex === "4") {
              closingMessage = "We've finished this part of the study. Your input is appreciated! Please proceed to the next scenario.";
            }
          }
          
          appendMessage('bot', closingMessage);
          waitingForResponse = false;
          return;
        }
        
        // Update exchange count
        exchangeCount++;
        
        // Show thinking indicator
        showThinking();
        
        // Get bot reply
        const reply = await getBotReply(userText);
        
        // Hide thinking indicator
        hideThinking();
        
        // Show bot reply with typing effect
        appendMessage('bot', reply);
        
        // Calculate how long the typing will take
        const typingDuration = reply.length * 15 + 300; // message length × typing speed + buffer
        
        // Re-enable input only after typing effect completes
        setTimeout(() => {
          waitingForResponse = false;
          userInput.disabled = false;
          submitButton.disabled = false;
          userInput.focus();
        }, typingDuration);

        // Update the time of the last message
        lastMessageTime = Date.now();
      });
    }, randomDelay); // End of setTimeout for random delay
  });
