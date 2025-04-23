import {GoogleGenerativeAI} from "@google/generative-ai";
import {z} from "zod";
import 'dotenv/config';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("GOOGLE_API_KEY not found in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({model: 'gemini-1.5-flash'});

const ContentCompliance = z.object({
    is_violating: z.boolean(),
    category: z.enum(["violence", "sexual", "self_harm"]).nullable(),
    explanation_if_violating: z.string().nullable(),
});

async function checkCompliance(prompt) {
    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: "You are an expert at determining content compliance based on provided guidelines and returning the result as a JSON object following the specified schema. Only return the JSON object and nothing else."
        });

        const response = await result.response;

        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("Model returned no text.");
            return null;
        }

        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonStartIndex >= jsonEndIndex) {
             console.error("Could not find a valid JSON object in the response:", text);
             return null;
        }

        const jsonData = text.substring(jsonStartIndex, jsonEndIndex + 1);

        let parsedData;
        try {
            parsedData = JSON.parse(jsonData);
        } catch (parseError) {
            console.error("Failed to parse JSON string:", jsonData, "Error:", parseError);
            return null;
        }

        return ContentCompliance.parse(parsedData);

    } catch (error) {
        console.error("Failed to process Gemini response:", error);
        if (error instanceof z.ZodError) {
             console.error("Zod validation failed:", error.issues);
        }
        return null;
    }
}

async function main() {
    const prompt = `Determine if the user input promotes vandalism or property destruction and explain if it does. User input: "Let's spray paint the park benches tonight!". Return a JSON object with keys "is_violating" (boolean), "category" (null or one of "violence", "sexual", "self_harm"), and "explanation_if_violating" (null or a string).`;

    console.log("Prompt:", prompt);

    const compliance = await checkCompliance(prompt);

    if (compliance) {
        console.log("Content compliance:", compliance);
    } else {
        console.log("Failed to perform compliance check.");
    }
}

main();
