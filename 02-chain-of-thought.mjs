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

const Step = z.object({
    explanation: z.string(),
    output: z.string(),
});

const GuideSteps = z.object({
    steps: z.array(Step), 
});


async function extractStructuredData(prompt) {
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

        return GuideSteps.parse(parsedData);

    } catch (error) {
        console.error("Failed to process Gemini response:", error);
        if (error instanceof z.ZodError) {
             console.error("Zod validation failed:", error.issues);
        }
        return null;
    }
}

async function main() {
    const prompt = `Надай покроковий посібник про найкращий спосіб піднятися на гору Еверест. Поверни результат у вигляді JSON об'єкта з ключем "steps". "steps" має бути масивом об'єктів, кожен з яких представляє етап або пораду, з ключами "explanation" (опис етапу) та "output" (ключові дії або результат цього етапу). Відповідь надавай українською мовою.`;

    console.log("Prompt:", prompt);

    const everestGuide = await extractStructuredData(prompt);

    if (everestGuide) {
        console.log("Parsed Everest climbing guide:", everestGuide);
    } else {
        console.log("Failed to parse Everest climbing guide.");
    }
}

main();