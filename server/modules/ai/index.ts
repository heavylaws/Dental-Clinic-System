import { Router, Request, Response } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/extract", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            res.status(500).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY." });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
Extract the patient demographic information from this document.
Return a JSON object exactly matching the structure below.
Do not include markdown formatting or explanations, just the JSON.
{
    "firstName": "string",
    "lastName": "string",
    "fatherName": "string",
    "gender": "Male" | "Female" | null,
    "dateOfBirth": "YYYY-MM-DD",
    "phone": "string",
    "city": "string",
    "region": "string",
    "maritalStatus": "Single" | "Married" | "Divorced" | "Widowed" | null,
    "allergies": "string",
    "chronicConditions": "string",
    "notes": "string"
}
If a field cannot be found, omit it or set it to null.
        `.trim();

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: req.file.buffer.toString("base64"),
                                mimeType: req.file.mimetype,
                            }
                        }
                    ],
                },
            ],
            config: {
                // @ts-ignore
                responseMimeType: "application/json",
            }
        });

        const textRes = response.text || "{}";
        let parsed = {};
        try {
            parsed = JSON.parse(textRes);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", textRes);
            res.status(500).json({ error: "AI returned invalid JSON" });
            return;
        }

        res.json({ data: parsed });

    } catch (error: any) {
        console.error("AI extraction error:", error);
        res.status(500).json({ error: error.message || "Failed to extract data" });
    }
});

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            res.status(500).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY." });
            return;
        }

        const { message, history } = req.body;
        
        if (!message) {
            res.status(400).json({ error: "Message is required" });
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const systemInstruction = `
You are a helpful and polite multilingual AI assistant for the DermClinic system. 
You are embedded directly into the clinic's management dashboard. 
Your goal is to help doctors, reception users, and admins navigate the system and understand how to use it.
- Automatically reply in the language the user speaks to you.
- Keep your answers concise, practical, and helpful. Use markdown formatting.
- Do not invent non-existent features. If you are unsure, say you do not know. 

Here is exactly how the DermClinic system works to help you answer questions accurately:
*   **Checking Medication Prescriptions / Reports**: To check how many times a medication (e.g., Panadol) was prescribed, tell them to go to the **"Reports"** page from the top navigation. Under **"Custom Prescription Report"**, select the Start and End dates, type the medication name in the 'Medication' autocomplete field, and click **Generate Report**. It will show a summary table and total counts.
*   **Adding/Finding a Patient**: Go to **"Patients"** in the top navigation. There they can search for patients or add a new patient.
*   **Billing**: Go to the **"Billing"** page to see unpaid invoices, payments, and generated bills.
*   **Appointments**: Go to the **"Appointments"** page to schedule or view appointments.
*   **Adding a Visit/Diagnosis/Prescription/Image**: Tell them to first search for the patient and open the **Patient File**. From the patient's record, they can add new visits, write prescriptions, order labs, and upload patient images/documents.
*   **Settings / Database Backups**: Go to the **"Settings"** page to change clinic details, change their password, and (for admins) restore database backups.
`.trim();

        const formattedHistory = Array.isArray(history) ? history.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: msg.parts || [{ text: msg.text || "" }]
        })) : [];

        // For genai SDK, we construct contents array with history then the new message
        const contents = [
            ...formattedHistory,
            { role: "user", parts: [{ text: message }] }
        ];

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] }
            }
        });

        res.json({ text: response.text });
    } catch (error: any) {
        console.error("AI chat error:", error);
        res.status(500).json({ error: error.message || "Failed to generate chat response" });
    }
});

export { router as aiRouter };
