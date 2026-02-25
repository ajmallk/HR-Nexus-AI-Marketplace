import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMatchmakingAdvice(projectDescription: string, consultantBios: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `As an AI HR Matchmaker, analyze this project description and the list of consultant bios. 
    Rank the top 3 consultants for this project and explain why they are a good fit.
    
    Project: ${projectDescription}
    
    Consultants:
    ${consultantBios.map((bio, i) => `${i + 1}. ${bio}`).join("\n")}
    
    Return the response in a structured format.`,
  });

  return response.text;
}

export async function generateJobDescription(brief: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a professional HR service project description based on this brief: "${brief}". 
    Include sections for Scope of Work, Required Expertise, and Expected Deliverables.`,
  });

  return response.text;
}

export async function analyzeBid(projectDesc: string, bidProposal: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this bid proposal against the project description. 
    Provide a score from 1-10 on relevance and a brief summary of pros and cons.
    
    Project: ${projectDesc}
    Bid: ${bidProposal}`,
  });

  return response.text;
}
