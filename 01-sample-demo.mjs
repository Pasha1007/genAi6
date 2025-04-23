import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import 'dotenv/config';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("GOOGLE_API_KEY not found in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

const CookBook = z.object({
    name: z.string(), 
    timeToCook: z.string(),
    ingredients: z.array(z.string()), 
});

async function extractCook(prompt) {
    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: "You are an expert at extracting information from text and returning it as a JSON object following the specified schema. Only return the JSON object and nothing else."
        });

        const response = await result.response;

        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
            console.error("Unexpected response format from Gemini:", response);
            return null;
        }

        let text = response.candidates[0].content.parts[0].text.trim();

        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonStartIndex >= jsonEndIndex) {
             console.error("Could not find a valid JSON object in the response:", text);
             return null;
        }

        text = text.substring(jsonStartIndex, jsonEndIndex + 1);

        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (parseError) {
            console.error("Failed to parse JSON string:", text, "Error:", parseError);
            return null;
        }

        return CookBook.parse(parsedData);

    } catch (error) {
        console.error("Failed to process Gemini response or validate data:", error);
        return null;
    }
}

async function main() {
    const prompt = `Extract the recipe details from this text: "Quick and easy scrambled eggs. You will need 3 eggs, a splash of milk, salt, and pepper. Takes about 5 minutes to cook.". Return the result as a JSON object with the keys "name" (the recipe title), "timeToCook" (the total time to cook as a string), and "ingredients" (the list of ingredients as an array of strings).`;

    console.log("Prompt:", prompt);

    const recipeInfo = await extractCook(prompt);

    if (recipeInfo) {
        console.log("Parsed recipe:", recipeInfo);
    } else {
        console.log("Failed to parse recipe details.");
    }
}

main();