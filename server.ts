import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize the Express router
const app = express();
const PORT = 3000;

// Set up body parser with increased limit to support camera base64 payloads
app.use(express.json({ limit: "15mb" }));

// Lazy initializer for the Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Ensure it is configured in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST API endpoint for analyzing camera scans
app.post("/api/scan", async (req, res): Promise<any> => {
  try {
    const { image, mimeType, mode } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const type = mimeType || "image/jpeg";
    // Strip headers if they exist in the base64 string
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const client = getGeminiClient();

    // Mode-specific instructions
    let promptText = "";
    switch (mode) {
      case "plant_animal":
        promptText = 
          "Analyze this image. If it contains a plant, flower, insect, bird, mammal, or fish, " +
          "identify its exact species. Provide its common name, scientific name in parentheses as the subtitle, " +
          "and give a detailed natural history and care/behavior description. " +
          "Provide attributes like: Species, Family, Native Habitat, Conservation Status, or standard care/diet. " +
          "If it is not a plant or animal, treat it as general but provide plant/animal category details.";
        break;
      case "food":
        promptText = 
          "Analyze this food item, meal, or ingredient. Identify what it is, give its name, " +
          "and provide its approximate macronutrient balance and primary estimated ingredients in the description. " +
          "Provide attributes like: Approx. Calories, Macronutrients, Primary Ingredients, Common Allergens. " +
          "Include safe consumption guidelines or brief recipe tips in the extraContext field.";
        break;
      case "text":
        promptText = 
          "Perform deep OCR on any visible text in this image. Extract all words, identify the primary language " +
          "as the subtitle, summarize the key message or layout clearly in the description, " +
          "and provide any action items or neat structure. " +
          "Provide attributes like: Primary Language, Text Quality, Word Count, OCR Status. " +
          "Provide a direct full English transcription or translation in the extraContext field.";
        break;
      case "general":
      default:
        promptText = 
          "Perform a comprehensive visual analysis of this scanned image. Identify the prominent object, " +
          "scene, or text. Give its common name, a brief but highly informative 2-3 sentence overview, " +
          "and supply attributes like: Est. Category, Material/Composition, Dimensions/Scale, and Purpose. " +
          "Provide any extra educational context, tips, or historic facts in the extraContext field.";
        break;
    }

    const imagePart = {
      inlineData: {
        mimeType: type,
        data: base64Data,
      },
    };

    const textPart = {
      text: promptText,
    };

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedItem: {
              type: Type.STRING,
              description: "The primary identified name or title of the scanned target.",
            },
            subtitle: {
              type: Type.STRING,
              description: "A short sub-heading, category name, scientific name, or quick classification.",
            },
            description: {
              type: Type.STRING,
              description: "A solid 2-3 sentence clear explanation describing what this is and its significance.",
            },
            attributes: {
              type: Type.ARRAY,
              description: "A collection of 3-5 specific characteristics or metrics about the object.",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "Name of the attribute, e.g., 'Material', 'Habitat'." },
                  value: { type: Type.STRING, description: "The quality or metric, e.g., 'Maple Wood', 'Tropical Forest'." },
                },
                required: ["label", "value"],
              },
            },
            extraContext: {
              type: Type.STRING,
              description: "Additional interesting facts, context, warnings, or tips.",
            },
          },
          required: ["detectedItem", "subtitle", "description", "attributes", "extraContext"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from GenAI");
    }

    const result = JSON.parse(responseText.trim());
    res.json(result);
  } catch (error: any) {
    console.error("Scanning Error:", error);
    res.status(500).json({ error: error.message || "Failed to scan image" });
  }
});

// Configure Vite or Static Asset delivery
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
