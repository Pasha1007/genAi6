import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import 'dotenv/config';
import fs from "fs";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("GOOGLE_API_KEY not found in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

const CVElement = z.object({
    type: z.enum([
        "section-header",
        "text-input",
        "textarea",
        "date-input",
        "email-input",
        "phone-input",
        "url-input",
        "bullet-list-item",
        "submit-button"
    ]),
    label: z.string().optional(),
    name: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    value: z.string().optional(),
});

const CVForm = z.object({
    type: z.literal("cv-form"),
    elements: z.array(CVElement),
});

async function generateUI(prompt) {
    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: `You are a UI generator AI. Convert the user input into a JSON object representing a CV form structure. The JSON must have a root object with a "type" key strictly equal to "cv-form" and an "elements" key, where "elements" is an array of objects. Each object in the "elements" array should represent a UI element and include relevant keys like "type" (from the enum: "section-header", "text-input", "textarea", "date-input", "email-input", "phone-input", "url-input", "bullet-list-item", "submit-button"), "label", "name", "required", "placeholder", and "value" (for bullet-list-item). Strictly follow this structure. Only return the JSON object and nothing else.`
        });

        const response = await result.response;
        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("Model returned no text.");
            return null;
        }

        console.log("Raw model output before JSON extraction:");
        console.log(text);

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

        return CVForm.parse(parsedData);

    } catch (error) {
        console.error("Failed to process Gemini response or validate data:", error);
        if (error instanceof z.ZodError) {
             console.error("Zod validation failed:", error.issues);
        }
        return null;
    }
}

function convertToHTML(ui) {
    let html = "";
    let inList = false;

    html += `<form class="cv-form">\n`;

    if (ui.elements && ui.elements.length > 0) {
        ui.elements.forEach(element => {
            switch (element.type) {
                case "section-header":
                    if (inList) {
                        html += `  </ul>\n`;
                        inList = false;
                    }
                    html += `  <h2>${element.label || ''}</h2>\n`;
                    break;
                case "text-input":
                case "textarea":
                case "date-input":
                case "email-input":
                case "phone-input":
                case "url-input":
                     if (inList) {
                        html += `  </ul>\n`;
                        inList = false;
                    }
                    const inputType = element.type.replace('-input', '');
                    html += `  <div class="form-field">\n`;
                    if (element.label) {
                        html += `    <label for="${element.name || element.label.toLowerCase().replace(/\s+/g, "-")}">${element.label}</label>\n`;
                    }
                    if (element.type === "textarea") {
                         html += `    <textarea`;
                    } else {
                         html += `    <input type="${inputType}"`;
                    }
                    if (element.name) html += ` name="${element.name}"`;
                    if (element.label) html += ` id="${element.name || element.label.toLowerCase().replace(/\s+/g, "-")}"`;
                    if (element.required) html += ` required`;
                    if (element.placeholder) html += ` placeholder="${element.placeholder}"`;
                    if (element.type === "textarea") {
                         html += `></textarea>\n`;
                    } else {
                         html += `>\n`;
                    }
                    html += `  </div>\n`;
                    break;
                case "bullet-list-item":
                    if (!inList) {
                        html += `  <ul>\n`;
                        inList = true;
                    }
                    html += `    <li>${element.value || ''}</li>\n`;
                    break;
                case "submit-button":
                    if (inList) {
                        html += `  </ul>\n`;
                        inList = false;
                    }
                    html += `  <button type="submit"`;
                    if (element.name) html += ` name="${element.name}"`;
                    html += `>${element.label || 'Submit'}</button>\n`;
                    break;
                default:
                    console.warn(`Unknown element type: ${element.type}`);
                    break;
            }
        });
    }

    if (inList) {
        html += `  </ul>\n`;
    }

    html += `</form>\n`;

    return html;
}

async function main() {
    const prompt = "Make a detailed CV form including sections for Personal Information, Summary, Work Experience, Education, Skills, and Contact Information.";

    console.log("Prompt:", prompt);

    const ui = await generateUI(prompt);

    if (ui) {
        const html = convertToHTML(ui);

        console.log("UI JSON Structure:");
        console.log(ui);

        console.log("\nGenerated HTML:");
        console.log(html);

        const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated CV Form</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f7f6;
    }
    .cv-form {
      display: flex;
      flex-direction: column;
      gap: 25px;
      padding: 30px;
      border: 1px solid #dcdcdc;
      border-radius: 10px;
      background-color: #fff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    h2 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #5a9bd5;
      padding-bottom: 5px;
      margin-bottom: 20px;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 15px;
    }
    label {
      margin-bottom: 8px;
      font-weight: bold;
      color: #555;
    }
    input, textarea, select {
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 5px;
      font-size: 16px;
      width: 100%;
      box-sizing: border-box;
    }
    textarea {
        min-height: 100px;
        resize: vertical;
    }
    ul {
        list-style: disc inside;
        padding-left: 20px;
        margin-top: 10px;
        margin-bottom: 15px;
    }
    li {
        margin-bottom: 5px;
    }
    button {
      padding: 12px 20px;
      background-color: #5a9bd5;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      margin-top: 20px;
      align-self: flex-start;
      transition: background-color 0.3s ease;
    }
    button:hover {
      background-color: #4a8acb;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

        fs.writeFileSync("generated-cv-form.html", htmlDocument);
        console.log("\nHTML saved to generated-cv-form.html");
    } else {
        console.log("Failed to generate UI.");
    }
}

main();
