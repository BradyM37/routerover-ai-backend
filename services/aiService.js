const dotenv = require('dotenv');

dotenv.config();

// Try to load Hugging Face, but don't fail if it's not available
let HfInference;
let inference;
let HF_API_KEY = process.env.HF_API_KEY; // Define this at the top level

try {
  const { HfInference: HfInferenceImport } = require('@huggingface/inference');
  HfInference = HfInferenceImport;
  
  // Initialize Hugging Face client with API key and timeout
  if (HF_API_KEY) {
    inference = new HfInference(HF_API_KEY, {
      timeout: 30000 // 30 seconds timeout
    });
    console.log('Hugging Face inference initialized successfully');
  } else {
    console.log('No Hugging Face API key found, falling back to rule-based responses');
  }
} catch (error) {
  console.log('Hugging Face package not available, falling back to rule-based responses');
}

exports.processMessage = async (message, conversationHistory = []) => {
  // Check if Hugging Face is available
  if (inference) {
    try {
      console.log('Processing message with Hugging Face:', message);
      
      // Format conversation for the model
      let prompt = "You are RouteRover AI, an assistant for a home service company. ";
      prompt += "You help customers book appointments for services like cleaning, repair, plumbing, electrical, and landscaping. ";
      prompt += "Be friendly, helpful, and concise.\n\n";
      
      // Add conversation history
      if (conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          prompt += `${role}: ${msg.content}\n`;
        });
      }
      
      // Add current message
      prompt += `User: ${message}\nAssistant:`;
      
      console.log('Using Hugging Face API key:', HF_API_KEY ? 'Key is set' : 'Key is missing');
      console.log('Prompt being sent to model:', prompt);
      
      // Try a different model that's more reliable for this use case
      const response = await inference.textGeneration({
        model: 'facebook/opt-125m', // Even smaller, more reliable model
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true
        }
      });
      
      console.log('Hugging Face response:', response);
      
      // Extract the generated text
      const assistantMessage = response.generated_text.trim();
      
      // Simple intent detection
      const intent = detectIntent(message);
      
      return {
        response: assistantMessage,
        intent: intent,
        appointmentBooked: false
      };
    } catch (error) {
      console.error('Error calling Hugging Face API:', error);
      console.error('Error details:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      
      // Fallback to rule-based responses
      return generateFallbackResponse(message);
    }
  } else {
    // Hugging Face not available, use fallback
    console.log('Using fallback response system');
    return generateFallbackResponse(message);
  }
};


// Simple intent detection function
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment')) {
    return 'booking';
  } else if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
    return 'cancellation';
  } else if (lowerMessage.includes('service') || lowerMessage.includes('repair') || 
             lowerMessage.includes('clean') || lowerMessage.includes('plumb') || 
             lowerMessage.includes('electric') || lowerMessage.includes('landscape')) {
    return 'service_inquiry';
  } else {
    return 'general_conversation';
  }
}

// Generate a fallback response when API is unavailable
function generateFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Simple rule-based responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return {
      response: "Hello! I'm RouteRover AI. How can I help you today? I can schedule cleaning, repair, plumbing, electrical, or landscaping services for you.",
      intent: "greeting"
    };
  } else if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment')) {
    return {
      response: "I'd be happy to help you book an appointment. Could you please provide your name, address, the service you need, and your preferred date and time? Alternatively, you can use our form booking option for a smoother experience.",
      intent: "booking"
    };
  } else if (lowerMessage.includes('service')) {
    return {
      response: "We offer various services including cleaning, repair, plumbing, electrical, and landscaping. Which service are you interested in?",
      intent: "service_inquiry"
    };
  } else if (lowerMessage.includes('thank')) {
    return {
      response: "You're welcome! Is there anything else I can help you with today?",
      intent: "gratitude"
    };
  } else if (lowerMessage.includes('when') && lowerMessage.includes('company')) {
    return {
      response: "RouteRover was founded in 2025 to provide efficient and reliable home services with smart scheduling technology.",
      intent: "company_info"
    };
  } else {
    return {
      response: "I'm currently operating with limited capabilities. Could you try asking something about our services or booking an appointment? Alternatively, you can use our form booking option.",
      intent: "general_conversation"
    };
  }
}